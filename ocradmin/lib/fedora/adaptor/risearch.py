# Risearch Module

import httplib2
import urllib

class RiSearch(object):
    """
        Wrapper class for executing ItQL queries.
    """
    def __init__(self, url):
        self._url = url

    def query(self, querystr):
        """
            Execute a risearch query.
        """
        data = {
            "distinct" : "on",
            "format": "Sparql",
            "lang": "itql",
            "limit": "",
            "type": "tuples",
            "query" : querystr,
        }
        headers = {
            "Content-Type": "application/x-www-form-urlencoded",
        }

        import httplib2
        http = httplib2.Http()
        resphead, respdata = http.request(
            self._url,
            "POST",
            urllib.urlencode(data),
            headers,
        )
        if resphead["status"] != "200":
            raise Exception("risearch failed with status %s: %s" % (resphead["status"], respdata))

        return respdata

