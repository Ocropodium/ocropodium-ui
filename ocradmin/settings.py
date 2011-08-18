# Django settings for ocradmin project.


import os
import sys
import socket
import subprocess as sp

# Ensure celery/lazy loading Django models play nice 
import djcelery
djcelery.setup_loader()

SITE_ROOT = os.path.abspath(os.path.dirname(__file__))

# add lib dir to pythonpath
sys.path.insert(0, os.path.join(SITE_ROOT, "lib"))

# flag whether we're on a server.  Really need a better way of doing this.
# ocr1 is the db master
SERVER = False
MASTERNAME = "ocr1"
if os.environ.get("OCR_SERVER") and SITE_ROOT.find("/dev/") == -1:
    # WSGI can't print to stdout, so map
    # it to stderr
    sys.stdout = sys.stderr
    SERVER = True

# don't run in debug mode on the servers
DEBUG = TEMPLATE_DEBUG = not SERVER

# Path to some random binary tools
BIN_PATH = "%s/bin" % SITE_ROOT

# get architecture for the system we're running
# on - this is mainly for choosing the correct
# executable for the isri tools in bin/
ARCH = sp.Popen(
    ["uname -m"],
    shell=True,
    stdout=sp.PIPE
).communicate()[0].strip()

# add bin the env path
os.environ["PATH"] = "%s:%s" % (
        os.path.join(BIN_PATH, ARCH),
        os.environ.get("PATH", "")
)

NODETREE_PERSISTANT_CACHER = "ocradmin.plugins.cache.PersistantFileCacher"
#NODETREE_PERSISTANT_CACHER = "ocradmin.plugins.cache.MongoDBCacher"
NODETREE_USER_MAX_CACHE = 10 # Maximum cache size, in Megabytes

ADMINS = (
)

MANAGERS = ADMINS

DATABASE_HOST = "localhost" if not SERVER else MASTERNAME
DATABASE_NAME = "ocr_testing" # if DEBUG else "ocr_production"
DATABASE_USER = "ocr_testing" # if DEBUG else "ocr_production"
DATABASES = {
    'default' : {
        'ENGINE'    : 'django.db.backends.mysql',
        'NAME'      : DATABASE_NAME,
        'USER'      : DATABASE_USER,
        'PASSWORD'  : 'changeme',
        'HOST'      : DATABASE_HOST,
    },
}

if 'test' in sys.argv:
    DATABASES['default'] = {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': 'ocr_testing'
    }

# celery settings 
CELERY_RESULT_BACKEND = "database"
CELERY_RESULT_DBURI = "mysql://celery:celery@localhost/celeryresults"
BROKER_HOST = "localhost" if not SERVER else MASTERNAME
BROKER_PORT = 5672
BROKER_VHOST = "/"
BROKER_USER = "guest"
BROKER_PASSWORD = "guest"
CELERYD_LOG_LEVEL = "INFO"
CELERYD_LOG_FILE = "%s/log/celeryd.log" % SITE_ROOT
CELERYBEAT_LOG_LEVEL = "INFO"
CELERYBEAT_LOG_FILE = "%s/log/celerybeat.log" % SITE_ROOT 
TRACK_STARTED = True
SEND_EVENTS = True

# User Celery's test_runner.  This sets ALWAYS_EAGER to True so
# that tasks skip the DB infrastructure and run locally
TEST_RUNNER = "celery_test_runner.CeleryTestSuiteRunner" 

# tagging stuff
FORCE_LOWERCASE_TAGS = True
MAX_TAG_LENGTH = 50

# Local time zone for this installation. Choices can be found here:
# http://en.wikipedia.org/wiki/List_of_tz_zones_by_name
# although not all choices may be available on all operating systems.
# If running in a Windows environment this must be set to the same as your
# system time zone.
TIME_ZONE = 'Europe/London'

# Language code for this installation. All choices can be found here:
# http://www.i18nguy.com/unicode/language-identifiers.html
LANGUAGE_CODE = 'en-gb'

# Login URL
LOGIN_URL = "/accounts/login/"
LOGIN_REDIRECT_URL = "/ocr/binarize/"

SITE_ID = 1

# If you set this to False, Django will make some optimizations so as not
# to load the internationalization machinery.
USE_I18N = True

# Absolute path to the directory that holds media.
# Example: "/home/media/media.lawrence.com/"
MEDIA_ROOT = "%s/media" % SITE_ROOT if not SERVER else "/media/share"

# Absolute path to the directory that holds media.
# Example: "/home/media/media.lawrence.com/"
ADMIN_MEDIA_ROOT = "%s/media" % SITE_ROOT if not SERVER else "/media/share"

# URL that handles the media served from MEDIA_ROOT. Make sure to use a
# trailing slash if there is a path component (optional in other cases).
# Examples: "http://media.lawrence.com", "http://example.com/media/"
MEDIA_URL = '/media/'

# Base path for transitory files
TEMP_PATH = "temp"

# Base path for user project files.
USER_FILES_PATH = "files"

# Size for thumbnails
THUMBNAIL_SIZE = (256, 256)

# URL prefix for admin media -- CSS, JavaScript and images. Make sure to use a
# trailing slash.
# Examples: "http://foo.com/media/", "/media/".
ADMIN_MEDIA_PREFIX = '/admin_media/'

# Make this unique, and don't share it with anybody.
SECRET_KEY = 'vg@k)$%0#dn=xdelu613c6)y%yhxs)6himtf0l(i)dcpq_9jzp'

# List of callables that know how to import templates from various sources.
TEMPLATE_LOADERS = (
#    'django.template.loaders.filesystem.load_template_source',
    'django.template.loaders.filesystem.Loader',
    'django.template.loaders.app_directories.load_template_source',
#     'django.template.loaders.eggs.load_template_source',
)

MIDDLEWARE_CLASSES = (
    'django.middleware.common.CommonMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
)

TEMPLATE_CONTEXT_PROCESSORS = (
    'django.contrib.auth.context_processors.auth',
    'django.core.context_processors.debug',
    'django.core.context_processors.i18n',
    'django.core.context_processors.media',
    'django.core.context_processors.request',
    'django.contrib.messages.context_processors.messages',
)

ROOT_URLCONF = 'ocradmin.urls'

# Static root media/css/etc
STATIC_ROOT = "%s/static" % SITE_ROOT
STATIC_URL = "/static/"

TEMPLATE_DIRS = (
    # Put strings here, like "/home/html/django_templates" or "C:/www/django/templates".
    # Always use forward slashes, even on Windows.
    # Don't forget to use absolute paths, not relative paths.
    "%s/templates" % SITE_ROOT,
)
 
INSTALLED_APPS = (
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.sites',
    'django.contrib.admin',
    'autoslug',
    'djcelery',
    'filebrowser',
    'batch',
    'core',
    'ocrmodels',
    'presets',
    'plugins',
    'ocrtasks',
    'reference_pages',
    'training',
    'projects',
    'tagging',
    'test_utils',
    'transcripts',
    'compress',
)

SERIALIZATION_MODULES = {
    'python' : 'wadofstuff.django.serializers.python',
    'json' : 'wadofstuff.django.serializers.json'
}

COMPRESS_ROOT = STATIC_ROOT
COMPRESS_URL = STATIC_URL
COMPRESS_AUTO = True
# total hack around csstidy not working with CSS3 gradients, but us
# still wanting to use file concatenation
CSSTIDY_BINARY = "cp"
CSSTIDY_ARGUMENTS = ""
COMPRESS_CSS_FILTERS = None
COMPRESS_CSS = {
    "standard": {
        "source_filenames": (
            "css/appmenu.css",
            "css/layout-default.css",
            "css/forms.css",
            "css/projectbrowser.css",
            "css/list_widget.css",
            "css/messages.css",
            "css/clean.css",
        ),
        "output_filename": "css/standard_compress.css",
        "extra_context": {
            "media": "screen",
        }
    },
    "nodetree": {
        "source_filenames": (
            "css/nodetree.css",
            "css/preset_manager.css",
        ),
        "output_filename": "css/nodetree_compress.css",
        "extra_context": {
            "media": "screen",
        }

    },
    "viewers": {
        "source_filenames": (
            "css/viewer.css",
            "css/image_viewer.css",
            "css/text_viewer.css",
        ),
        "output_filename": "css/viewers_compress.css",
        "extra_context": {
            "media": "screen",
        }

    },

    "transcript_edit": {
        "source_filenames": (            
           "css/transcript_editor.css",
           "css/line_editor.css",
           "css/spellcheck.css",
        ),
        "output_filename": "css/transcript_edit_compress.css",
        "extra_context": {
            "media": "screen",
        }
    },
}

COMPRESS_JS = {
    "jquery": {
        "source_filenames": (
            "js/jquery/jquery-1.6.js",
            "js/jquery/jquery-ui-1.8.4.custom.min.js",
            "js/jquery/jquery.cookie.js",
            "js/jquery/jquery.globalstylesheet.js",
            "js/jquery/jquery.text-overflow.min.js",
            "js/jquery/jquery.titlecase.js",
            "js/jquery/jquery.tmpl.js",
            "js/jquery/jquery.rightClick.js",
            "js/jquery/jquery.mousewheel.min.js",
            "js/jquery/jquery.layout-latest.js",
        	"js/jquery/jquery.hoverIntent.min.js",
        ),
        "output_filename": "js/jquery_compress.js",
    },
    "utils" : {
        "source_filenames": (
            "js/utils/json2.js",
            "js/utils/base.js",
        ),
        "output_filename": "js/utils_compress.js",
    },
    "global": {
        "source_filenames": (
            "js/ocrbase.js",
            "js/helpers.js",
            "js/constants.js",
            "js/abstract_data_source.js",    
            "js/project_data_source.js",
            "js/abstract_list_widget.js",
            "js/project_list_widget.js",
            "js/projectbrowser.js",
            "js/appmenu.js",
            "js/global.js",
            "js/status_bar.js",
            "js/undo/command.js",
            "js/undo/macro.js",
            "js/undo/stack.js",
        ),
        "output_filename": "js/global_compress.js",
    },
    "nodetree": {
        "source_filenames": (
	        "js/jquery/jquery.svg.js",
            "js/jquery/jquery.svgdom.min.js",
            "js/nodetree/svg_helper.js",
            "js/nodetree/cable.js",
            "js/nodetree/plug.js",
            "js/nodetree/node.js",
            "js/nodetree/node_tree.js",
            "js/nodetree/parameters.js",
            "js/nodetree/gui_manager.js",
            "js/nodegui/base_gui.js",
            "js/nodegui/crop_gui.js",
            "js/nodegui/manualseg_gui.js",
            "js/nodetree/cable.js",
            "js/preset_manager.js",
            "js/result_handler.js",
            "js/crypto/bencode.js",
            "js/crypto/md5.js",
        ),
        "output_filename": "js/nodetree_compress.js",
    },
    "viewers": {
        "source_filenames": (
            "js/seadragon/seadragon-min.js",
            "js/image_viewer.js",
            "js/hocr_utils.js",
            "js/text_viewer.js",
            "js/hocr_viewer.js",
	        "js/utils/stats.js",
            "js/line_formatter.js",
        ),
        "output_filename": "js/viewers_compress.js",        
    },
    "transcript_edit": {
        "source_filenames": (
            "js/line_editor.js",
            "js/spellcheck/suggestion_list.js",
            "js/spellcheck/spellchecker.js",
            "js/transcript_editor.js",
        ),
        "output_filename": "js/viewers_compress.js",        
    },
}

