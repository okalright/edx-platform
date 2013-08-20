from contentstore.tests.utils import CourseTestCase
from xmodule.modulestore.tests.factories import CourseFactory
from django.core.urlresolvers import reverse
from xmodule.capa_module import CapaDescriptor
import json
from xmodule.modulestore.django import modulestore
from xmodule.contentstore.django import contentstore
from xmodule.contentstore.content import StaticContent
from xmodule.exceptions import NotFoundError
import datetime
from pytz import UTC


class DeleteItem(CourseTestCase):
    """Tests for '/delete_item' url."""
    def setUp(self):
        """ Creates the test course with a static page in it. """
        super(DeleteItem, self).setUp()
        self.course = CourseFactory.create(org='mitX', number='333', display_name='Dummy Course')

    def test_delete_static_page(self):
        # Add static tab
        data = json.dumps({
            'parent_location': 'i4x://mitX/333/course/Dummy_Course',
            'category': 'static_tab'
        })

        resp = self.client.post(
            reverse('create_item'),
            data,
            content_type="application/json"
        )
        self.assertEqual(resp.status_code, 200)

        # Now delete it. There was a bug that the delete was failing (static tabs do not exist in draft modulestore).
        resp = self.client.post(
            reverse('delete_item'),
            resp.content,
            "application/json"
        )
        self.assertEqual(resp.status_code, 204)


class TestCreateItem(CourseTestCase):
    """
    Test the create_item handler thoroughly
    """
    def response_id(self, response):
        """
        Get the id from the response payload
        :param response:
        """
        parsed = json.loads(response.content)
        return parsed['id']

    def test_create_nicely(self):
        """
        Try the straightforward use cases
        """
        # create a chapter
        display_name = 'Nicely created'
        resp = self.client.post(
            reverse('create_item'),
            json.dumps({
                'parent_location': self.course.location.url(),
                'display_name': display_name,
                'category': 'chapter'
            }),
            content_type="application/json"
        )
        self.assertEqual(resp.status_code, 200)

        # get the new item and check its category and display_name
        chap_location = self.response_id(resp)
        new_obj = modulestore().get_item(chap_location)
        self.assertEqual(new_obj.scope_ids.block_type, 'chapter')
        self.assertEqual(new_obj.display_name, display_name)
        self.assertEqual(new_obj.location.org, self.course.location.org)
        self.assertEqual(new_obj.location.course, self.course.location.course)

        # get the course and ensure it now points to this one
        course = modulestore().get_item(self.course.location)
        self.assertIn(chap_location, course.children)

        # use default display name
        resp = self.client.post(
            reverse('create_item'),
            json.dumps({
                'parent_location': chap_location,
                'category': 'vertical'
            }),
            content_type="application/json"
        )
        self.assertEqual(resp.status_code, 200)

        vert_location = self.response_id(resp)

        # create problem w/ boilerplate
        template_id = 'multiplechoice.yaml'
        resp = self.client.post(
            reverse('create_item'),
            json.dumps({
                'parent_location': vert_location,
                'category': 'problem',
                'boilerplate': template_id
            }),
            content_type="application/json"
        )
        self.assertEqual(resp.status_code, 200)
        prob_location = self.response_id(resp)
        problem = modulestore('draft').get_item(prob_location)
        # ensure it's draft
        self.assertTrue(problem.is_draft)
        # check against the template
        template = CapaDescriptor.get_template(template_id)
        self.assertEqual(problem.data, template['data'])
        self.assertEqual(problem.display_name, template['metadata']['display_name'])
        self.assertEqual(problem.markdown, template['metadata']['markdown'])

    def test_create_item_negative(self):
        """
        Negative tests for create_item
        """
        # non-existent boilerplate: creates a default
        resp = self.client.post(
            reverse('create_item'),
            json.dumps(
                {'parent_location': self.course.location.url(),
                 'category': 'problem',
                 'boilerplate': 'nosuchboilerplate.yaml'
                 }),
            content_type="application/json"
        )
        self.assertEqual(resp.status_code, 200)


class TestEditItem(CourseTestCase):
    """
    Test contentstore.views.item.save_item
    """
    def response_id(self, response):
        """
        Get the id from the response payload
        :param response:
        """
        parsed = json.loads(response.content)
        return parsed['id']

    def setUp(self):
        """ Creates the test course structure and a couple problems to 'edit'. """
        super(TestEditItem, self).setUp()
        # create a chapter
        display_name = 'chapter created'
        resp = self.client.post(
            reverse('create_item'),
            json.dumps(
                {'parent_location': self.course.location.url(),
                 'display_name': display_name,
                 'category': 'chapter'
                 }),
            content_type="application/json"
        )
        chap_location = self.response_id(resp)
        resp = self.client.post(
            reverse('create_item'),
            json.dumps({
                'parent_location': chap_location,
                'category': 'sequential',
            }),
            content_type="application/json"
        )
        self.seq_location = self.response_id(resp)
        # create problem w/ boilerplate
        template_id = 'multiplechoice.yaml'
        resp = self.client.post(
            reverse('create_item'),
            json.dumps({
                'parent_location': self.seq_location,
                'category': 'problem',
                'boilerplate': template_id,
            }),
            content_type="application/json"
        )
        self.problems = [self.response_id(resp)]

    def test_delete_field(self):
        """
        Sending null in for a field 'deletes' it
        """
        self.client.post(
            reverse('save_item'),
            json.dumps({
                'id': self.problems[0],
                'metadata': {'rerandomize': 'onreset'}
            }),
            content_type="application/json"
        )
        problem = modulestore('draft').get_item(self.problems[0])
        self.assertEqual(problem.rerandomize, 'onreset')
        self.client.post(
            reverse('save_item'),
            json.dumps({
                'id': self.problems[0],
                'metadata': {'rerandomize': None}
            }),
            content_type="application/json"
        )
        problem = modulestore('draft').get_item(self.problems[0])
        self.assertEqual(problem.rerandomize, 'never')

    def test_null_field(self):
        """
        Sending null in for a field 'deletes' it
        """
        problem = modulestore('draft').get_item(self.problems[0])
        self.assertIsNotNone(problem.markdown)
        self.client.post(
            reverse('save_item'),
            json.dumps({
                'id': self.problems[0],
                'nullout': ['markdown']
            }),
            content_type="application/json"
        )
        problem = modulestore('draft').get_item(self.problems[0])
        self.assertIsNone(problem.markdown)

    def test_date_fields(self):
        """
        Test setting due & start dates on sequential
        """
        sequential = modulestore().get_item(self.seq_location)
        self.assertIsNone(sequential.due)
        self.client.post(
            reverse('save_item'),
            json.dumps({
                'id': self.seq_location,
                'metadata': {'due': '2010-11-22T04:00Z'}
            }),
            content_type="application/json"
        )
        sequential = modulestore().get_item(self.seq_location)
        self.assertEqual(sequential.due, datetime.datetime(2010, 11, 22, 4, 0, tzinfo=UTC))
        self.client.post(
            reverse('save_item'),
            json.dumps({
                'id': self.seq_location,
                'metadata': {'start': '2010-09-12T14:00Z'}
            }),
            content_type="application/json"
        )
        sequential = modulestore().get_item(self.seq_location)
        self.assertEqual(sequential.due, datetime.datetime(2010, 11, 22, 4, 0, tzinfo=UTC))
        self.assertEqual(sequential.start, datetime.datetime(2010, 9, 12, 14, 0, tzinfo=UTC))


class BaseSubtitles(CourseTestCase):
    """Base test class for subtitles tests."""

    org = 'MITx'
    number = '999'

    def clear_subs_content(self):
        """Remove, if subtitles content exists."""
        for youtube_id in self.get_youtube_ids().values():
            filename = 'subs_{0}.srt.sjson'.format(youtube_id)
            content_location = StaticContent.compute_location(
                self.org, self.number, filename)
            try:
                content = contentstore().find(content_location)
                contentstore().delete(content.get_id())
            except NotFoundError:
                pass

    def setUp(self):
        """Create initial data."""
        super(BaseSubtitles, self).setUp()

        # Add video module
        data = {
            'parent_location': str(self.course_location),
            'category': 'video',
            'type': 'video'
        }
        resp = self.client.post(reverse('create_item'), data)
        self.item_location = json.loads(resp.content).get('id')
        self.assertEqual(resp.status_code, 200)

        # hI10vDNYz4M - valid Youtube ID with subtitles.
        # JMD_ifUUfsU, AKqURZnYqpk, DYpADpL7jAY - valid Youtube IDs
        # without subtitles.
        data = '<video youtube="0.75:JMD_ifUUfsU,1.0:hI10vDNYz4M,1.25:AKqURZnYqpk,1.50:DYpADpL7jAY" />'
        modulestore().update_item(self.item_location, data)

        self.item = modulestore().get_item(self.item_location)

        # Remove all subtitles for current module.
        self.clear_subs_content()

    def get_youtube_ids(self):
        """Return youtube speeds and ids."""
        item = modulestore().get_item(self.item_location)

        return {
            0.75: item.youtube_id_0_75,
            1: item.youtube_id_1_0,
            1.25: item.youtube_id_1_25,
            1.5: item.youtube_id_1_5
        }


class ImportSubtitlesFromYoutube(BaseSubtitles):
    """Tests for saving video item."""

    def test_success_video_module_subs_importing(self):
        # Import subtitles.
        resp = self.client.post(
            reverse('save_item'), {'id': self.item_location, 'metadata': {}})

        self.assertEqual(resp.status_code, 204)

        # Check assets status after importing subtitles.
        for youtube_id in self.get_youtube_ids().values():
            filename = 'subs_{0}.srt.sjson'.format(youtube_id)
            content_location = StaticContent.compute_location(
                self.org, self.number, filename)
            self.assertTrue(contentstore().find(content_location))

    def test_fail_youtube_ids_unavailable(self):
        data = '<video youtube="0.75:BAD_YOUTUBE_ID1,1:BAD_YOUTUBE_ID2,1.25:BAD_YOUTUBE_ID3,1.5:BAD_YOUTUBE_ID4" />'
        modulestore().update_item(self.item_location, data)

        # Import subtitles.
        resp = self.client.post(
            reverse('save_item'), {'id': self.item_location, 'metadata': {}})

        self.assertEqual(resp.status_code, 204)

        for youtube_id in self.get_youtube_ids().values():
            filename = 'subs_{0}.srt.sjson'.format(youtube_id)
            content_location = StaticContent.compute_location(
                self.org, self.number, filename)
            self.assertRaises(
                NotFoundError, contentstore().find, content_location)

    def tearDown(self):
        super(ImportSubtitlesFromYoutube, self).tearDown()

        # Remove all subtitles for current module.
        self.clear_subs_content()

