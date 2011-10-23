# Run some tests on the fcobject classes

import fcobject
import unittest

class TestFedoraObject(fcobject.FedoraObject):
    NAMESPACE = "test-python-wrapper-object"
    

class TestFedoraObjectRunner(unittest.TestCase):
    def setUp(self):
        self.fco = TestFedoraObject()
        self.fco.save()        

    def testCreation(self):
        self.assertEqual(self.fco.is_saved(), True)
        self.assertTrue(self.fco.pid.startswith(TestFedoraObject.NAMESPACE))

    def testQuery(self):
        querystr = "pid~%s" % self.fco.pid
        results = TestFedoraObject.query(query=querystr)
        self.assertEqual(len(results), 1)

    def testUnsuccessfulQuery(self):
        querystr = "pid~ILLEGAL_PID"
        results = TestFedoraObject.query(query=querystr)
        self.assertEqual(len(results), 0)
 
    def testLazyLoad(self):
        # check there's no existing creation_date attribute
        self.assertEqual(None, self.fco.__dict__.get("creation_date"))
        cdate = self.fco.creation_date
        cdatecmp = TestFedoraObject.find(self.fco.pid).creation_date
        self.assertEqual(cdate.__class__.__name__, "datetime")
        self.assertEqual(cdate, cdatecmp)

    def testListDatastreams(self):
        # by default we should only have two datastreams: the DC and RELS-EXT
        dslist = self.fco.datastreams()
        self.assertEqual(len(dslist), 2)
        self.assertEqual(dslist[0].dsid, "DC")
        self.assertEqual(dslist[1].dsid, "RELS-EXT")

    def testAddDeleteDatastream(self):
        testdsid = "TEST_DS1" 
        ds = self.fco.new_datastream(testdsid, label="Test Datastream", 
                content="<some_xml></some_xml>", content_type="text/xml")
        ds.save()
        self.assertTrue(ds.is_saved())

        # test listing
        dslist = self.fco.datastreams()
        self.assertEqual(len(dslist), 3)
        self.assertEqual(dslist[2].dsid, testdsid)

        # now delete it again
        ds.delete()
        self.testListDatastreams()

    def testFindDatastream(self):
        ds = self.fco.datastream("DC")
        self.assertEqual(ds.dsid, "DC")

    def testSetDublincoreDict(self):
        newlabel = "Brand New Label"  
        dcd = self.fco.dublincore()
        dcd["label"] = newlabel
        self.fco.set_dublincore(dcd)

        # re-get the dict and check it's still the same
        dcd = self.fco.dublincore()
        self.assertEqual(dcd["label"], newlabel)
    

    def tearDown(self):
        self.fco.delete()

if __name__ == '__main__':
    unittest.main()
