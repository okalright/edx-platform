from django.conf.urls import url, patterns

urlpatterns = patterns('pipeline_js.views',  # nopep8
    url(r'^files\.json$', 'xmodule_js_files', name='xmodule_js_files'),
    url(r'^xmodule\.js$', 'requirejs_xmodule', name='requirejs_xmodule'),
)
