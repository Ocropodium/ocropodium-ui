#!/usr/bin/python

"""
Cruddy script for binarizing files via the OCR web UI.
"""

import os
import sys
import tempfile
import subprocess as sp
import httplib2
import time

from optparse import OptionParser

from poster.encode import multipart_encode
from poster.streaminghttp import register_openers
import urllib
import urllib2

import simplejson

SITE = "http://ocr1.cerch.kcl.ac.uk"
LOGIN = "/accounts/login"
BINURL = "/ocr/binarize/"
RESURL = "/ocr/results/"
USERNAME = "cerch"
PASSWORD = "1want0cr"


cookie = tempfile.NamedTemporaryFile()
cookie.close()


class OcrAdmin(object):
    def __init__(self, options):
        self.opts = options
        self.http = httplib2.Http()
        self.authheaders = None
        self.tokens = []

    def login(self):
        """
        Login and save the cookie
        """
        
        body = {"username": USERNAME, "password": PASSWORD}
        headers = {"Content-type": "application/x-www-form-urlencoded"}
        response, content = self.http.request(
                "%s%s" % (self.opts.host, LOGIN), 
                "POST", headers=headers, body=urllib.urlencode(body))
        self.authheaders = {"Cookie": response["set-cookie"]}



    def upload(self, files):
        """
        Upload files to be binarized.
        """

        if self.authheaders is None:
            self.login()

        # Register the streaming http handlers with urllib2
        register_openers()

        count = 1
        for f in files:
            self.tokens.append(self.upload_file(f, count))
            count += 1


    def upload_file(self, filename, count):
        """
        Upload a file to the server.
        """
        handle = open(filename, "rb")
        params = {"image%s" % count: handle}
        if self.opts.clean:
            params["clean"] = self.opts.clean
        datagen, headers = multipart_encode(
                params)
        headers.update(self.authheaders)

        # Create the Request object
        request = urllib2.Request("%s%s" % (self.opts.host, BINURL), datagen, headers)
        # Actually do the request, and get the response
        print "Uploading: %s" % filename
        token = simplejson.load(urllib2.urlopen(request))[0]
        token["file"] = filename
        token["count"] = count
        handle.close()
        return token
        

    def get_result(self, token):
        """
        Get results for a job.
        """
        url = "%s%s%s" % (self.opts.host, RESURL, token["job_name"])
        data = {} #{"format": "png"}
        #response, content = self.http.request(url, "GET", 
        #        urllib.urlencode(data), headers=self.authheaders)
        request = urllib2.Request(url, 
                urllib.urlencode(data), headers=self.authheaders)
        #print request
        response = urllib2.urlopen(request)
        #print response.read()
        content = response.read()
        #print "CONTENT: " + content
        outtoken = simplejson.loads(content)
        #print outtoken
        if outtoken["results"] is None:
            return False

        if not os.path.exists(self.opts.outdir):
            os.makedirs(self.opts.outdir)

        outfile = "%s/%04d.bin.png" % (self.opts.outdir, token["count"])
        outurl = "%s%s" % (self.opts.host, outtoken["results"]["out"])
        outreq = urllib2.Request(outurl, 
            urllib.urlencode(data), headers=self.authheaders) 
        outhandle = open(outfile, "wb")
        outhandle.write(urllib2.urlopen(outreq).read())
        outhandle.close()
        print "Wrote: %s" % outfile
        return True


    def get_results(self):
        """
        Poll for results.
        """

        while True:
            retries = []
            while self.tokens:
                token = self.tokens.pop(0)
                if not self.get_result(token):
                    retries.append(token)
                    time.sleep(0.05)
            if not retries:
                break

            self.tokens = retries


if __name__ == "__main__":


    usage = "%prog [options] file1.png file2.png"
    version = "%prog 1.00"
    parser = OptionParser(usage=usage, version=version)
    parser.add_option("--host", action="store", dest="host",
            default=SITE, help="Site URL")                      
    parser.add_option("-o", "--outdir", action="store", dest="outdir",
            default="book", help="Output directory name")                      
    parser.add_option("-c", "--clean", action="store", dest="clean",
            default="StandardPreprocessing", help="Cleanup preset")                      
    parser.add_option("-d", "--debug", action="store_true", dest="debug", 
                    help="show debug information")                                  
    (options, args) = parser.parse_args()
    
    ocr  = OcrAdmin(options)
    ocr.upload(args)
    ocr.get_results()
