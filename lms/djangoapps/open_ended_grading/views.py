import logging

from django.conf import settings
from django.views.decorators.cache import cache_control
from mitxmako.shortcuts import render_to_response
from django.core.urlresolvers import reverse

from student.models import unique_id_for_user
from courseware.courses import get_course_with_access

from xmodule.open_ended_grading_classes.grading_service_module import GradingServiceError
import json
from student.models import unique_id_for_user

import open_ended_notifications

from xmodule.modulestore.django import modulestore
from xmodule.modulestore import search
from xmodule.modulestore.exceptions import ItemNotFoundError, NoPathToItem

from django.http import HttpResponse, Http404, HttpResponseRedirect
from mitxmako.shortcuts import render_to_string
from django.utils.translation import ugettext as _

from open_ended_grading.utils import (STAFF_ERROR_MESSAGE, STUDENT_ERROR_MESSAGE,
                                      StudentProblemList, generate_problem_url, create_controller_query_service)

log = logging.getLogger(__name__)

def _reverse_with_slash(url_name, course_id):
    """
    Reverses the URL given the name and the course id, and then adds a trailing slash if
    it does not exist yet.
    @param url_name: The name of the url (eg 'staff_grading').
    @param course_id: The id of the course object (eg course.id).
    @returns: The reversed url with a trailing slash.
    """
    ajax_url = _reverse_without_slash(url_name, course_id)
    if not ajax_url.endswith('/'):
        ajax_url += '/'
    return ajax_url


def _reverse_without_slash(url_name, course_id):
    ajax_url = reverse(url_name, kwargs={'course_id': course_id})
    return ajax_url


DESCRIPTION_DICT = {
    'Peer Grading': _("View all problems that require peer assessment in this particular course."),
    'Staff Grading': _("View ungraded submissions submitted by students for the open ended problems in the course."),
    'Problems you have submitted': _("View open ended problems that you have previously submitted for grading."),
    'Flagged Submissions': _("View submissions that have been flagged by students as inappropriate."),
}

ALERT_DICT = {
    'Peer Grading': _("New submissions to grade"),
    'Staff Grading': _("New submissions to grade"),
    'Problems you have submitted': _("New grades have been returned"),
    'Flagged Submissions': _("Submissions have been flagged for review"),
}

@cache_control(no_cache=True, no_store=True, must_revalidate=True)
def staff_grading(request, course_id):
    """
    Show the instructor grading interface.
    """
    course = get_course_with_access(request.user, course_id, 'staff')

    ajax_url = _reverse_with_slash('staff_grading', course_id)

    return render_to_response('instructor/staff_grading.html', {
        'course': course,
        'course_id': course_id,
        'ajax_url': ajax_url,
        # Checked above
        'staff_access': True, })


def find_peer_grading_module(course):
    """
    Given a course, finds the first peer grading module in it.
    @param course: A course object.
    @return: boolean found_module, string problem_url
    """

    # Reverse the base course url.
    base_course_url = reverse('courses')
    found_module = False
    problem_url = ""

    # Get the course id and split it.
    course_id_parts = course.id.split("/")
    # Get the peer grading modules currently in the course.  Explicitly specify the course id to avoid issues with different runs.
    items = modulestore().get_items(['i4x', course_id_parts[0], course_id_parts[1], 'peergrading', None],
                                    course_id=course.id)
    #See if any of the modules are centralized modules (ie display info from multiple problems)
    items = [i for i in items if not getattr(i, "use_for_single_location", True)]
    # Loop through all potential peer grading modules, and find the first one that has a path to it.
    for item in items:
        item_location = item.location
        # Generate a url for the first module and redirect the user to it.
        try:
            problem_url_parts = search.path_to_location(modulestore(), course.id, item_location)
        except NoPathToItem:
            # In the case of nopathtoitem, the peer grading module that was found is in an invalid state, and
            # can no longer be accessed.  Log an informational message, but this will not impact normal behavior.
            log.info(u"Invalid peer grading module location {0} in course {1}.  This module may need to be removed.".format(item_location, course.id))
            continue
        problem_url = generate_problem_url(problem_url_parts, base_course_url)
        found_module = True

    return found_module, problem_url


@cache_control(no_cache=True, no_store=True, must_revalidate=True)
def peer_grading(request, course_id):
    '''
    When a student clicks on the "peer grading" button in the open ended interface, link them to a peer grading
    xmodule in the course.
    '''

    #Get the current course
    course = get_course_with_access(request.user, course_id, 'load')

    found_module, problem_url = find_peer_grading_module(course)
    if not found_module:
        error_message = _("""
        Error with initializing peer grading.
        There has not been a peer grading module created in the courseware that would allow you to grade others.
        Please check back later for this.
        """)
        log.exception(error_message + u"Current course is: {0}".format(course_id))
        return HttpResponse(error_message)

    return HttpResponseRedirect(problem_url)

@cache_control(no_cache=True, no_store=True, must_revalidate=True)
def student_problem_list(request, course_id):
    """
    Show a list of problems they have attempted to a student.
    Fetch the list from the grading controller server and append some data.
    @param request: The request object for this view.
    @param course_id: The id of the course to get the problem list for.
    @return: Renders an HTML problem list table.
    """

    # Load the course.  Don't catch any errors here, as we want them to be loud.
    course = get_course_with_access(request.user, course_id, 'load')

    # The anonymous student id is needed for communication with ORA.
    student_id = unique_id_for_user(request.user)
    base_course_url = reverse('courses')
    error_text = ""

    student_problem_list = StudentProblemList(course_id, student_id)
    # Get the problem list from ORA.
    success = student_problem_list.fetch_from_grading_service()
    # If we fetched the problem list properly, add in additional problem data.
    if success:
        # Add in links to problems.
        valid_problems = student_problem_list.add_problem_data(base_course_url)
    else:
        # Get an error message to show to the student.
        valid_problems = []
        error_text = student_problem_list.error_text

    ajax_url = _reverse_with_slash('open_ended_problems', course_id)

    context = {
        'course': course,
        'course_id': course_id,
        'ajax_url': ajax_url,
        'success': success,
        'problem_list': valid_problems,
        'error_text': error_text,
        # Checked above
        'staff_access': False,
        }

    return render_to_response('open_ended_problems/open_ended_problems.html', context)

@cache_control(no_cache=True, no_store=True, must_revalidate=True)
def flagged_problem_list(request, course_id):
    '''
    Show a student problem list
    '''
    course = get_course_with_access(request.user, course_id, 'staff')
    student_id = unique_id_for_user(request.user)

    # call problem list service
    success = False
    error_text = ""
    problem_list = []
    base_course_url = reverse('courses')

    # Make a service that can query edX ORA.
    controller_qs = create_controller_query_service()
    try:
        problem_list_json = controller_qs.get_flagged_problem_list(course_id)
        problem_list_dict = json.loads(problem_list_json)
        success = problem_list_dict['success']
        if 'error' in problem_list_dict:
            error_text = problem_list_dict['error']
            problem_list = []
        else:
            problem_list = problem_list_dict['flagged_submissions']

    except GradingServiceError:
        #This is a staff_facing_error
        error_text = STAFF_ERROR_MESSAGE
        #This is a dev_facing_error
        log.error("Could not get flagged problem list from external grading service for open ended.")
        success = False
    # catch error if if the json loads fails
    except ValueError:
        #This is a staff_facing_error
        error_text = STAFF_ERROR_MESSAGE
        #This is a dev_facing_error
        log.error("Could not parse problem list from external grading service response.")
        success = False

    ajax_url = _reverse_with_slash('open_ended_flagged_problems', course_id)
    context = {
        'course': course,
        'course_id': course_id,
        'ajax_url': ajax_url,
        'success': success,
        'problem_list': problem_list,
        'error_text': error_text,
        # Checked above
        'staff_access': True,
    }
    return render_to_response('open_ended_problems/open_ended_flagged_problems.html', context)


@cache_control(no_cache=True, no_store=True, must_revalidate=True)
def combined_notifications(request, course_id):
    """
    Gets combined notifications from the grading controller and displays them
    """
    course = get_course_with_access(request.user, course_id, 'load')
    user = request.user
    notifications = open_ended_notifications.combined_notifications(course, user)
    response = notifications['response']
    notification_tuples = open_ended_notifications.NOTIFICATION_TYPES

    notification_list = []
    for response_num in xrange(0, len(notification_tuples)):
        tag = notification_tuples[response_num][0]
        if tag in response:
            url_name = notification_tuples[response_num][1]
            human_name = notification_tuples[response_num][2]
            url = _reverse_without_slash(url_name, course_id)
            has_img = response[tag]

            # check to make sure we have descriptions and alert messages
            if human_name in DESCRIPTION_DICT:
                description = DESCRIPTION_DICT[human_name]
            else:
                description = ""

            if human_name in ALERT_DICT:
                alert_message = ALERT_DICT[human_name]
            else:
                alert_message = ""

            notification_item = {
                'url': url,
                'name': human_name,
                'alert': has_img,
                'description': description,
                'alert_message': alert_message
            }
            #The open ended panel will need to link the "peer grading" button in the panel to a peer grading
            #xmodule defined in the course.  This checks to see if the human name of the server notification
            #that we are currently processing is "peer grading".  If it is, it looks for a peer grading
            #module in the course.  If none exists, it removes the peer grading item from the panel.
            if human_name == "Peer Grading":
                found_module, problem_url = find_peer_grading_module(course)
                if found_module:
                    notification_list.append(notification_item)
            else:
                notification_list.append(notification_item)

    ajax_url = _reverse_with_slash('open_ended_notifications', course_id)
    combined_dict = {
        'error_text': "",
        'notification_list': notification_list,
        'course': course,
        'success': True,
        'ajax_url': ajax_url,
    }

    return render_to_response('open_ended_problems/combined_notifications.html', combined_dict)


@cache_control(no_cache=True, no_store=True, must_revalidate=True)
def take_action_on_flags(request, course_id):
    """
    Takes action on student flagged submissions.
    Currently, only support unflag and ban actions.
    """
    if request.method != 'POST':
        raise Http404

    required = ['submission_id', 'action_type', 'student_id']
    for key in required:
        if key not in request.POST:
            error_message = u'Missing key {0} from submission.  Please reload and try again.'.format(key)
            response = {
                'success': False,
                'error': STAFF_ERROR_MESSAGE + error_message
            }
            return HttpResponse(json.dumps(response), mimetype="application/json")

    p = request.POST
    submission_id = p['submission_id']
    action_type = p['action_type']
    student_id = p['student_id']
    student_id = student_id.strip(' \t\n\r')
    submission_id = submission_id.strip(' \t\n\r')
    action_type = action_type.lower().strip(' \t\n\r')

    # Make a service that can query edX ORA.
    controller_qs = create_controller_query_service()
    try:
        response = controller_qs.take_action_on_flags(course_id, student_id, submission_id, action_type)
        return HttpResponse(response, mimetype="application/json")
    except GradingServiceError:
        log.exception(
            u"Error taking action on flagged peer grading submissions, "
            u"submission_id: {0}, action_type: {1}, grader_id: {2}".format(
            submission_id, action_type, student_id)
        )
        response = {
            'success': False,
            'error': STAFF_ERROR_MESSAGE
        }
        return HttpResponse(json.dumps(response),mimetype="application/json")
