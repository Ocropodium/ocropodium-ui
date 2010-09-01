# Django settings for ocradmin project.


import os
import sys
import socket

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
if SITE_ROOT.find("/dev/") == -1:
    # WSGI can't print to stdout, so map
    # it to stderr
    sys.stdout = sys.stderr
    SERVER = True


# don't run in debug mode on the servers
DEBUG = TEMPLATE_DEBUG = not SERVER

ADMINS = (
    ('Michael Bryant', 'mikesname@gmail.com'),
)

MANAGERS = ADMINS

#DATABASE_ENGINE = 'sqlite3'           # 'postgresql_psycopg2', 'postgresql', 'mysql', 'sqlite3' or 'oracle'.
#DATABASE_NAME = "%s/admindb" % SITE_ROOT    # Or path to database file if using sqlite3.
#DATABASE_USER = ''                          # Not used with sqlite3.
#DATABASE_PASSWORD = ''         # Not used with sqlite3.
#DATABASE_HOST = ''             # Set to empty string for localhost. Not used with sqlite3.
#DATABASE_PORT = ''             # Set to empty string for default. Not used with sqlite3.

DATABASE_HOST = "localhost" if not SERVER else MASTERNAME
DATABASE_NAME = "ocr_testing" if DEBUG else "ocr_production"
DATABASE_USER = "ocr_testing" if DEBUG else "ocr_production"
DATABASES = {
    'default' : {
        'ENGINE'    : 'django.db.backends.mysql',
        'NAME'      : DATABASE_NAME,
        'USER'      : DATABASE_USER,
        'PASSWORD'  : 'changeme',
        'HOST'      : DATABASE_HOST,
    },
}

# celery settings - not sure this'll work...
# mysql
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
TEST_RUNNER = "djcelery.contrib.test_runner.run_tests" 

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

SITE_ID = 1

# If you set this to False, Django will make some optimizations so as not
# to load the internationalization machinery.
USE_I18N = True

# Path to some random binary tools
BIN_PATH = "%s/bin" % SITE_ROOT

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
    'django.template.loaders.filesystem.load_template_source',
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
    'djcelery',
    'accounts',
    'filebrowser',
    'batch',
    'ocr',
    'ocrmodels',
    'ocrpresets',
    'ocrtasks',
    'training',
    'projects',
    'tagging',
)

SERIALIZATION_MODULES = {
    'python' : 'wadofstuff.django.serializers.python',
    'json' : 'wadofstuff.django.serializers.json'
}


