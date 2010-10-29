

$(document).ready(function(){  

    module("OCR Page Object Test");

    test("Initialisation test", function() {
        expect(1);  
        
        var testdiv = $("<div></div>").attr("id", "test_div");
        $("body").append(testdiv);
        same($("#test_div").attr("id"), testdiv.attr("id"), 
            "Document insertion test failed: expected " + testdiv.attr("id"),
            $("test_div").attr("id"));

    });


    test("Sample test", function() {  
        expect(1);  
        equals(4 / 2, 2,  
            'Expected 2 as the result, result was: ' + 4/2);  
  });  
});  
