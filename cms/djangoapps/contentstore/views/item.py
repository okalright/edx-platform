"""Views for items (modules)."""

import os
import logging
import json
from uuid import uuid4


from django.core.exceptions import PermissionDenied
from django.contrib.auth.decorators import login_required
from django.http import HttpResponseBadRequest
from django.http import HttpResponse, Http404
from django.template.defaultfilters import slugify

from xmodule.modulestore import Location
from xmodule.modulestore.django import modulestore
from xmodule.modulestore.inheritance import own_metadata
from xmodule.modulestore.exceptions import ItemNotFoundError, InvalidLocationError
from xmodule.contentstore.django import contentstore
from xmodule.contentstore.content import StaticContent
from xmodule.exceptions import NotFoundError

from util.json_request import expect_json, JsonResponse
from ..utils import (get_modulestore, manage_video_subtitles,
                     return_ajax_status, generate_subs_from_source,
                     generate_srt_from_sjson, requests as rqsts)
from .access import has_access
from .requests import _xmodule_recurse
from xmodule.x_module import XModuleDescriptor

__all__ = [
    'save_item', 'create_item', 'delete_item', 'upload_subtitles',
    'download_subtitles', 'check_subtitles']

log = logging.getLogger(__name__)

# cdodge: these are categories which should not be parented, they are detached from the hierarchy
DETACHED_CATEGORIES = ['about', 'static_tab', 'course_info']

log = logging.getLogger(__name__)

@login_required
@expect_json
def save_item(request):
    """
    Will carry a json payload with these possible fields
    :id (required): the id
    :data (optional): the new value for the data
    :metadata (optional): new values for the metadata fields.
        Any whose values are None will be deleted not set to None! Absent ones will be left alone
    :nullout (optional): which metadata fields to set to None
    """
    # The nullout is a bit of a temporary copout until we can make module_edit.coffee and the metadata editors a
    # little smarter and able to pass something more akin to {unset: [field, field]}

    try:
        item_location = request.POST['id']
    except KeyError:
        import inspect

        log.exception(
            '''Request missing required attribute 'id'.
                Request info:
                %s
                Caller:
                Function %s in file %s
            ''',
            request.META,
            inspect.currentframe().f_back.f_code.co_name,
            inspect.currentframe().f_back.f_code.co_filename
        )
        return HttpResponseBadRequest()


    try:
        old_item = modulestore().get_item(item_location)
    except (ItemNotFoundError, InvalidLocationError):
        log.error("Can't find item by location.")
        return JsonResponse()

    # check permissions for this user within this course
    if not has_access(request.user, item_location):
        raise PermissionDenied()

    store = get_modulestore(Location(item_location))

    if request.POST.get('data') is not None:
        data = request.POST['data']
        store.update_item(item_location, data)

    # cdodge: note calling request.POST.get('children') will return None if children is an empty array
    # so it lead to a bug whereby the last component to be deleted in the UI was not actually
    # deleting the children object from the children collection
    if 'children' in request.POST and request.POST['children'] is not None:
        children = request.POST['children']
        store.update_children(item_location, children)

    # cdodge: also commit any metadata which might have been passed along
    if request.POST.get('nullout') is not None or request.POST.get('metadata') is not None:
        # the postback is not the complete metadata, as there's system metadata which is
        # not presented to the end-user for editing. So let's fetch the original and
        # 'apply' the submitted metadata, so we don't end up deleting system metadata
        existing_item = modulestore().get_item(item_location)
        for metadata_key in request.POST.get('nullout', []):
            setattr(existing_item, metadata_key, None)

        # update existing metadata with submitted metadata (which can be partial)
        # IMPORTANT NOTE: if the client passed 'null' (None) for a piece of metadata that means 'remove it'. If
        # the intent is to make it None, use the nullout field
        for metadata_key, value in request.POST.get('metadata', {}).items():
            field = existing_item.fields[metadata_key]

            if value is None:
                field.delete_from(existing_item)
            else:
                value = field.from_json(value)
                field.write_to(existing_item, value)
        # Save the data that we've just changed to the underlying
        # MongoKeyValueStore before we update the mongo datastore.
        existing_item.save()
        # commit to datastore
        store.update_metadata(item_location, own_metadata(existing_item))

    try:
        new_item = modulestore().get_item(item_location)
    except (ItemNotFoundError, InvalidLocationError):
        log.error("Can't find item by location.")
        return JsonResponse()

    if new_item.category == 'video':
        manage_video_subtitles(old_item, new_item)

    return JsonResponse()


@login_required
@expect_json
def create_item(request):
    """View for create items."""
    parent_location = Location(request.POST['parent_location'])
    category = request.POST['category']

    display_name = request.POST.get('display_name')

    if not has_access(request.user, parent_location):
        raise PermissionDenied()

    parent = get_modulestore(category).get_item(parent_location)
    dest_location = parent_location.replace(category=category, name=uuid4().hex)

    # get the metadata, display_name, and definition from the request
    metadata = {}
    data = None
    template_id = request.POST.get('boilerplate')
    if template_id is not None:
        clz = XModuleDescriptor.load_class(category)
        if clz is not None:
            template = clz.get_template(template_id)
            if template is not None:
                metadata = template.get('metadata', {})
                data = template.get('data')

    if display_name is not None:
        metadata['display_name'] = display_name

    get_modulestore(category).create_and_save_xmodule(
        dest_location,
        definition_data=data,
        metadata=metadata,
        system=parent.system,
    )

    if category not in DETACHED_CATEGORIES:
        get_modulestore(parent.location).update_children(parent_location, parent.children + [dest_location.url()])

    return JsonResponse({'id': dest_location.url()})


@login_required
@expect_json
def delete_item(request):
    """View for removing items."""
    item_location = request.POST['id']
    item_location = Location(item_location)

    # check permissions for this user within this course
    if not has_access(request.user, item_location):
        raise PermissionDenied()

    # optional parameter to delete all children (default False)
    delete_children = request.POST.get('delete_children', False)
    delete_all_versions = request.POST.get('delete_all_versions', False)

    store = get_modulestore(item_location)

    item = store.get_item(item_location)

    if delete_children:
        _xmodule_recurse(item, lambda i: store.delete_item(i.location, delete_all_versions))
    else:
        store.delete_item(item.location, delete_all_versions)

    # cdodge: we need to remove our parent's pointer to us so that it is no longer dangling
    if delete_all_versions:
        parent_locs = modulestore('direct').get_parent_locations(item_location, None)

        for parent_loc in parent_locs:
            parent = modulestore('direct').get_item(parent_loc)
            item_url = item_location.url()
            if item_url in parent.children:
                children = parent.children
                children.remove(item_url)
                parent.children = children
                modulestore('direct').update_children(parent.location, parent.children)

    return JsonResponse()


@login_required
@return_ajax_status
def upload_subtitles(request):
    """Try to upload subtitles for current module."""

    # This view return True/False, cause we use `return_ajax_status`
    # view decorator.
    item_location = request.POST.get('id')
    if not item_location:
        log.error('POST data without "id" form data.')
        return False

    if 'file' not in request.FILES:
        log.error('POST data without "file" form data.')
        return False

    source_subs_filedata = request.FILES['file'].read()
    source_subs_filename = request.FILES['file'].name

    if '.' not in source_subs_filename:
        log.error("Undefined file extension.")
        return False

    basename = os.path.basename(source_subs_filename)
    source_subs_name = os.path.splitext(basename)[0]
    source_subs_ext = os.path.splitext(basename)[1][1:]

    try:
        item = modulestore().get_item(item_location)
    except (ItemNotFoundError, InvalidLocationError):
        log.error("Can't find item by location.")
        return False

    # Check permissions for this user within this course.
    if not has_access(request.user, item_location):
        raise PermissionDenied()

    if item.category != 'video':
        log.error('Subtitles are supported only for "video" modules.')
        return False

    speed_subs = {
        0.75: item.youtube_id_0_75,
        1: item.youtube_id_1_0,
        1.25: item.youtube_id_1_25,
        1.5: item.youtube_id_1_5
    }

    if any(speed_subs.values()):
        log.error("We don't support uploading subs for Youtube video modules.")
        return False
    elif any(item.html5_sources):
        sub_attr = slugify(source_subs_name)

        # Generate only one subs for speed = 1.0
        status = generate_subs_from_source(
            {1: sub_attr},
            source_subs_ext,
            source_subs_filedata,
            item)

        if status:
            item.sub = sub_attr
            item.save()
            store = get_modulestore(Location(item_location))
            store.update_metadata(item_location, own_metadata(item))
    else:
        log.error('Empty video sources.')
        return False

    return status


@login_required
def download_subtitles(request):
    """Try to download subtitles for current modules."""

    item_location = request.GET.get('id')
    if not item_location:
        log.error('GET data without "id" property.')
        raise Http404

    try:
        item = modulestore().get_item(item_location)
    except (ItemNotFoundError, InvalidLocationError):
        log.error("Can't find item by location.")
        raise Http404

    # Check permissions for this user within this course.
    if not has_access(request.user, item_location):
        raise PermissionDenied()

    if item.category != 'video':
        log.error('Subtitles are supported only for video" modules.')
        raise Http404

    speed = 1
    speed_subs = {
        0.75: item.youtube_id_0_75,
        1: item.youtube_id_1_0,
        1.25: item.youtube_id_1_25,
        1.5: item.youtube_id_1_5
    }

    if any(speed_subs.values()):
        log.error("We don't support downloading subs for Youtube video modules.")
        raise Http404
    elif item.sub:
        filename = 'subs_{0}.srt.sjson'.format(item.sub)
        content_location = StaticContent.compute_location(
            item.location.org, item.location.course, filename)
        try:
            sjson_subtitles = contentstore().find(content_location)
        except NotFoundError:
            log.error("Can't find content in storage for non-youtube sub.")
            raise Http404

        srt_file_name = item.sub
    else:
        log.error('Blank "sub" field.')
        raise Http404

    str_subs = generate_srt_from_sjson(json.loads(sjson_subtitles.data), speed)
    if str_subs is None:
        raise Http404

    response = HttpResponse(str_subs, content_type='application/x-subrip')
    response['Content-Disposition'] = 'attachment; filename="{0}.srt"'.format(
        srt_file_name)

    return response


@login_required
def check_subtitles(request):
    """Check subtitles availability for current modules."""
    subtitles_presence = {
        'html5_local': False,
        'youtube_local': False,
        'youtube_server': False,
        'status': 'Error'
    }

    video_id = request.POST.get('video_id')
    if not video_id:
        log.error('Incoming data without "video_id" property.')
        return JsonResponse(subtitles_presence)

    html_id = 'i4x-blades-1-video-0e8733e7fa084068aeb53bd2320f9663'
    item_location = Location(html_id.split('-'))
    try:
        item = modulestore().get_item(item_location)
    except (ItemNotFoundError, InvalidLocationError):
        log.error("Can't find item by location.")
        return JsonResponse(subtitles_presence)

    # Check permissions for this user within this course.
    if not has_access(request.user, item_location):
        raise PermissionDenied()

    if item.category != 'video':
        log.error('Subtitles are supported only for "video" modules.')
        return JsonResponse(subtitles_presence)

    subtitles_presence['status'] = 'Good'

    # Check for youtube local subtitles presense
    speed_subs = {
        0.75: item.youtube_id_0_75,
        1: item.youtube_id_1_0,
        1.25: item.youtube_id_1_25,
        1.5: item.youtube_id_1_5
    }

    for speed, sub in speed_subs.items():
        if not sub:
            continue
        filename = 'subs_{0}.srt.sjson'.format(sub)
        content_location = StaticContent.compute_location(
            item.location.org, item.location.course, filename)
        try:
            contentstore().find(content_location)
            subtitles_presence['youtube_local'] = True
        except NotFoundError:
            log.error("Can't find subtitles in storage for youtube speed: {} and video_id: {}".format(speed, sub))

    # Check for youtube server subtitles presence
    for speed, youtube_id in sorted(speed_subs.iteritems()):
        if not youtube_id:
            continue
        data = rqsts.get(
            "http://video.google.com/timedtext",
            params={'lang': 'en', 'v': youtube_id}
        )

        if data.status_code == 200 and data.text:
            subtitles_presence['youtube_server'] = True
            break

    # Check for html5 local subtitles presence
    if item.sub:
        filename = 'subs_{0}.srt.sjson'.format(item.sub)
        content_location = StaticContent.compute_location(
            item.location.org, item.location.course, filename)
        try:
            contentstore().find(content_location)
            subtitles_presence['edx'] = True
        except NotFoundError:
            log.error("Can't find subtitles in storage for non-youtube video_id: {}".format(video_id))

    return JsonResponse(subtitles_presence)
