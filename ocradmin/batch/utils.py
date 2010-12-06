# OCR Batch utils

import os
import re
import subprocess as sp



class Aspell(object):
    """
    Aspell Wrapper.
    """
    suggestre = re.compile("& (?P<word>\S+) (?P<numsuggestions>\d+) \d+: (?P<suggestions>.+)")
    nomatchre = re.compile("# (?P<word>\S+) \d+")
    def __init__(self):
        """
        Initialise an Aspell object.
        """
        pass

    def spellcheck(self, data):        
        """
        Spellcheck some data.
        """
        pipe = self._get_aspell_pipe("-a -d en")
        head = pipe.stdout.readline()
        if head.find("International Ispell") == -1:
            raise AssertionError("Unexpected Ispell output: " + head)
        # switch to terse mode
        pipe.stdin.write('!\n')
        # write the data
        pipe.stdin.write(data.encode('utf8') + "\n")
        stdout, stderr = pipe.communicate()
        
        out = {}
        for line in stdout.split("\n"):
            if line.startswith("&"):
                m = self.suggestre.match(line)
                captures = m.groupdict()
                captures["suggestions"] = m.group("suggestions").split(", ")
                out[m.group("word")] = captures
            elif line.startswith("#"):
                n = self.nomatchre.match(line)
                captures = n.groupdict()
                captures["numsuggestions"] = "0"
                out[n.group("word")] = captures
        return out


    def dump_dicts(self):
        """
        Show available dictionaries.
        """
        pipe = self._get_aspell_pipe("dump dicts")
        dicts = pipe.communicate()[0]
        return dicts.split("\n")


    def _get_aspell_pipe(self, options):
        """
        Open an aspell command.
        """
        return sp.Popen(["aspell %s" % options], shell=True, 
                stdout=sp.PIPE, stdin=sp.PIPE, close_fds=True) 

if __name__=="__main__":
    a = Aspell()
    print a.spellcheck("This is some\nlins to check")
