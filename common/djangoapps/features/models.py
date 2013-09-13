"""
Add and create new modes for running courses on this particular LMS
"""
from django.db import models

from django.utils.translation import ugettext as _


class Features(models.Model):
    """
    Enable specific features on a course-by-course basis.
    """
    # The course that these features are attached to.
    course_id = models.CharField(max_length=255, db_index=True)

    # Whether or not to enable instructor email
    enable_email = models.BooleanField(default=False)

    class Meta:
        """ meta attributes of this model """
        unique_together = ('course_id', 'enable_email')

    @classmethod
    def instructor_email_enabled(cls, course_id):
        """
        Returns whether or not email is enabled for the given course id.

        If email has not been explicitly enabled, returns False.
        """
        features = cls.objects.filter(course_id=course_id)
        return features.get(enable_email, False)
