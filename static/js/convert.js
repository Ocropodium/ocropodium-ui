// the uploader...
var uploader = null;


function saveState() {
    $.cookie("engine", $("input[@name=engine]:checked").attr("value"));
    $.each(["psegmenter", "cmodel", "lmodel"], function(index, item) {
        $.cookie(item, $("select[name=" + item + "]").attr("value"));     
    });
}


function loadState() {
    var engine = $.cookie("engine");
    if (engine) {
        $("input[value='" + engine + "']").attr("checked", true);
    }
    $.each(["psegmenter", "cmodel", "lmodel"], function(index, item) {
        var val = $.cookie(item);
        if (val) {
            $("select[name=" + item + "]").val(val);
        }
    });


}

// save state on leaving the page... at least try to...
window.onbeforeunload = function(event) {
    saveState();
}



$(function() {


    $(".ocr_line").live("click", function(e) {
            //alert("clicked!");
    });

    $("#singleupload").change(function(event) {
        if ($(this).val() == "") {
            return false;
        }
        $("#uploadform").submit();
    });

    $("#uploadform").ajaxForm({
        data : { _iframe: 1 },
        dataType: "json",
        success: function(data, responseText, xhr) {
            onXHRLoad(data, responseText, xhr);
            $("#singleupload").val("");
        },
    });



    /**
    *
    *  Function to build the lang & char models selects when
    *  the engine type is changed.
    *
    **/

    function rebuildModelLists(appname) {
        var opt = $("<option />");
        var copt = $("#form_cmodel").val();
        var lopt = $("#form_lmodel").val();

        $("#uploadform").attr("disabled", "disabled");
        $.get(
            "/ocrmodels/search",
            { app: appname },
            function(response) {
                //var data = $.parseJSON(response);
                //alert(response + " : " + data);

                $("#form_cmodel").html("");
                $("#form_lmodel").html("");
                $.each(response, function(index, item) {
                    var select = item.fields.type == "char"
                        ? $("#form_cmodel")
                        : $("#form_lmodel");


                    var newopt = opt.clone()
                            .text(item.fields.name)
                            .attr("value", item.fields.name);
                    if (item.fields.name == copt) {
                        newopt.attr("selected", "selected");
                    }
                    
                    select.append(newopt);
                    //alert(item.fields.name);
                });
                $("#uploadform").removeAttr("disabled");
            }
        );

    }

    $("input[name=engine]").change(function(e) {
        rebuildModelLists($(this).val());
    });


    
    $(".ocr_line").live("mouseover mouseout", function(e) {
        if (e.type == "mouseover") {
            $(this).css("border-color", "red");    
        } else {
            $(this).css("border-color", "white");     
        }
    });

    $(".view_link").live("click", function(e) {
        var divid = $(this).parent().attr("id").replace(/_head$/, "");
        if ($(this).text() == "View Layout") {
            positionByBounds($("#" + divid));
            $(this).text("View Paragraphs");
        } else {
            $("#" + divid).attr("style", "");
            insertBreaks($("#" + divid));
            $(this).text("View Layout");
        }
        return false;            
    });


    function processData(element, data) {
        if (data.error) {
            element
                .removeClass("waiting")                
                .addClass("error")
                .html("<h4>Error: " + data.error + "</h4>")
                .append(
                    $("<div></div>").addClass("traceback")
                        .append("<pre>" + data.trace + "</pre>")                                
                );                            
        } else if (data.status == "SUCCESS") {
            $.each(data.results.lines, function(linenum, line) {
                lspan = $("<span></span>")
                    .text(line.text)
                    .addClass("ocr_line")
                    .attr("bbox", line.box[0] + " " + line.box[1] 
                        + " " + line.box[2] + " " + line.box[3]);
                element.append(lspan);                        
            });
            element.removeClass("waiting");
            insertBreaks(element);
        } else if (data.status == "PENDING") {
            setTimeout(function() {
                pollForResults(element);
                }, 250 * Math.max(1, uploader.size())
            );
        } else {
            element.html("<p>Oops, task finished with status: " + data.status + "</p>");
        }
    }


    function pollForResults(element) {
        var jobname = element.data("jobname");
        $.ajax({
            url: "/ocr/results/" + jobname,
            dataType: "json",
            success: function(data) {
                processData(element, data);    
            },
            error: function(xhr, statusText, errorThrown) {
                element.addClass("error")
                    .html("<h4>Http Error</h4>")
                    .append("<div>" + errorThrown + "</div>");                
            }
        }); 
    }

    function createPage(page, pageresults) {
        var pagename = pageresults.job_name.split("::")[0].replace(/\.[^\.]+$/, "");

        var viewlink = $("<a></a>")
                    .attr("target", "_blank")
                    .addClass("result_link");

        var phead = $("<div></div>")
            .addClass("ocr_page_head")
            .attr("id", "ocr_page_" + pagename + "_head")
            .text(pagename)
            .append($("<a></a>").attr("href", "#").addClass("view_link").text("View Layout"))                
            .append(
                viewlink.clone()
                    .attr("href", "/ocr/results/" + pageresults.job_name + "?format=text")
                    .text("Text")
            )                
            .append(
                viewlink.clone()
                    .attr("href", "/ocr/results/" + pageresults.job_name + "?format=json")
                    .text("Json")
            );                
        var pdiv = $("<div></div>")
            .addClass("ocr_page")
            .addClass("waiting")
            .attr("id", "ocr_page_" + pagename)
            .data("jobname", pageresults.job_name);

        $("#pageout").append(phead).append(pdiv);        

        // set off the timer polling for the page results...
        pollForResults(pdiv);
    }


    function onXHRLoad(event_or_response) {
        var data;
        if (event_or_response.target != null) {
            var xhr = event_or_response.target;
            if (!xhr.responseText) {
                return;
            }                
            if (xhr.status != 200) {
                return alert("Error: " + xhr.responseText + "  Status: " + xhr.status);
            } 
            data = $.parseJSON(xhr.responseText);
        } else {
            // then it must be a single upload...
            data = event_or_response;
        }

        if (data.error) {
            alert("Error: " + data.error + "\n\n" + data.trace);
            $("#dropzone").text("Drop images here...").removeClass("waiting");
            return;
        }

        $.each(data, function(page, pageresults) {
            createPage(page, pageresults);
        }); 
    };


    // initialise the uploader...
    uploader  = new AjaxUploader("/ocr/convert", "dropzone");
    uploader.onXHRLoad = onXHRLoad;
    uploader.onUploadsStarted = function(e) {
        $("#pageout").html("");
        uploader.registerTextParameter("input[@name=engine]:checked"); 
        uploader.registerTextParameter("#form_segmenter"); 
        uploader.registerTextParameter("#form_cmodel"); 
        uploader.registerTextParameter("#form_lmodel"); 
    };



    rebuildModelLists($("input[name=engine]:checked").val());    


    loadState();


});

