
// Function to build the lang & char models selects when
// the engine type is changed.
function rebuildModelLists(appname) {
    var opt = $("<option />");
    var copt = $("#form_cmodel").val();
    var lopt = $("#form_lmodel").val();

    $("#uploadform").attr("disabled", "disabled");
    $.get(
        "/ocrmodels/search",
        { app: appname },
        function(response) {
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
            });
            $("#uploadform").removeAttr("disabled");
        }
    );
}


function saveState() {
    $.cookie("engine", $("input[name=engine]:checked").attr("value"));
    $.each(["clean", "psegmenter", "cmodel", "lmodel"], function(index, item) {
        $.cookie(item, $("select[name=" + item + "]").attr("value"));     
    });

    // save the job names of the current pages...
    var jobnames = $(".ocr_page").map(function(i, d) {
        return $(d).data("jobname");
    }).get().join(",");
    $.cookie("jobnames", jobnames, {expires: 7});
}


function loadState() {
    var engine = $.cookie("engine");
    if (engine) {
        $("input[value='" + engine + "']").attr("checked", true);
    }
    $.each(["clean", "psegmenter", "cmodel", "lmodel"], function(index, item) {
        var val = $.cookie(item);
        if (val) {
            $("select[name=" + item + "]").val(val);
        }
    });

    var jobnames = $.cookie("jobnames");
    if (jobnames) {
        var joblist = jobnames.split(",");
        $.each(joblist, function(index, jobname) {
            pageobjects[index] = new OcrPage("workspace", index, jobname);
            pageobjects[index].onLinesReady = function() {
                // trigger a reformat
                $("input[name=format]:checked").click();
            }
            pageobjects[index].pollForResults();            
        });
        layoutWidgets();
        updateUiState();
    }
}

// save state on leaving the page... at least try to...
window.onbeforeunload = function(event) {
    saveState();
}


function onXHRLoad(event) {
    var xhr = event.target;
    if (!xhr.responseText) {
        return;
    }                
    if (xhr.status != 200) {
        return alert("Error: " + xhr.responseText + "  Status: " + xhr.status);
    } 
    var data = $.parseJSON(xhr.responseText);
    if (data.error) {
        alert("Error: " + data.error + "\n\n" + data.trace);
        $("#dropzone").text("Drop images here...").removeClass("waiting");
        return;
    }
    $.each(data, function(pagenum, pageresults) {
        pageobjects[pagenum] = new OcrPage("workspace", pagenum, pageresults.job_name);
        var timeout = (300 * Math.max(1, uploader.size())) + (pagenum * 250);
        pageobjects[pagenum].onLinesReady = function() {
            // trigger a reformat
            $("input[name=format]:checked").click();
        }

        pageobjects[pagenum].pollForResults(timeout);
        layoutWidgets();
        updateUiState();
    }); 
};


function relayoutPages(maxheight) {
    var top = $(".ocr_page_container").first();
    var start = top.position().top + top.outerHeight(true);
    top.nextAll().each(function(i, elem) {
        $(elem).css("top", start + "px");
        start = start + $(elem).outerHeight(true);
    });
}

function updateUiState() {
    var pcount = $(".ocr_page_container").length;
    $(".tbbutton").button({disabled: pcount < 1});
    $(".ocr_page").css("font-size", $("#font_size").val() + "px");
}



var pageobjects = [];
var uploader = null;
//var pbuilder = null;
var formatter = null;

const MINFONTSIZE = 6;
const MAXFONTSIZE = 40;

$(function() {

    // style toolbar
    $(".tbbutton").button({
        disabled: true,
    });
    $("#clear").button({
        icons: {
            primary: "ui-icon-closethick",
        }
    });
    $("#format").buttonset();

    $("#engine").buttonset();

    $("#clear").click(function(event) {
        pageobjects = [];
        $(".ocr_page_container").remove();
        $.cookie("jobnames", null);
        updateUiState();
    });

    $("#download").click(function(event) {
        var jobnames = [];
        $(".ocr_page").each(function(i, elem) {
            jobnames.push("task=" + $(elem).data("jobname"));
        });
        $("#download").attr("href", "/ocr/zipped_results/?" + jobnames.join("&"));
    });

    $("#zoomin").click(function(event) {
        $("#font_size").val(parseInt($("#font_size").val()) + 2);
        $("#zoomin").button({"disabled": $("#font_size").val() >= MAXFONTSIZE});
        $("#zoomout").button({"disabled": $("#font_size").val() <= MINFONTSIZE});
        $(".ocr_page").css("font-size", $("#font_size").val() + "px");
        relayoutPages();
    }).button({
        text: false,
        icons: {
            primary: "ui-icon-zoomin",
        }
    });

    $("#zoomout").click(function(event) {
        $("#font_size").val(parseInt($("#font_size").val()) - 2);
        $("#zoomin").button({"disabled": $("#font_size").val() >= MAXFONTSIZE});
        $("#zoomout").button({"disabled": $("#font_size").val() <= MINFONTSIZE});
        $(".ocr_page").css("font-size", $("#font_size").val() + "px");
        relayoutPages();
    }).button({
        text: false,
        icons: {
            primary: "ui-icon-zoomout",
        }
    });

    $("input[name=engine]").change(function(e) {
        rebuildModelLists($(this).val());
    });

    $("#format_block").click(function(event) {
        formatter.blockLayout($(".ocr_page"));
        relayoutPages();
    });
    $("#format_line").click(function(event) {
        formatter.lineLayout($(".ocr_page"));
        relayoutPages();
    });
    $("#format_column").click(function(event) {
        $(".ocr_page").each(function(pos, elem) {
            formatter.columnLayout($(elem));
        });
        relayoutPages();
    });



    // initialise the uploader...
    uploader  = new OCRJS.AjaxUploader($("#dropzone").get(0), "/ocr/convert");
    uploader.onXHRLoad = onXHRLoad;
    uploader.onUploadsStarted = function(e) {
        $("#dropzone").text("Please wait...").addClass("waiting");
        uploader.registerTextParameter("input[name=engine]:checked"); 
        $("#optionsform input[type='text'], #optionsform select").each(function(i, elem) {
            uploader.registerTextParameter(elem);
        });
    };
    uploader.onUploadsFinished = function(e) {
        $("#dropzone").text("Drop images here...").removeClass("waiting"); 
    };

    // load state stored from last time
    loadState();

    // line formatter object
    formatter = new OcrLineFormatter();

    // fetch the appropriate models...
    rebuildModelLists($("input[name=engine]:checked").val());    

    // initialise the controls
    //pbuilder = new ParameterBuilder("options", ["ISegmentLine", "IGrouper"]);
    //pbuilder.registerComponent("grouper", "Grouper", "StandardGrouper");
    //pbuilder.registerComponent("segmenter", "Line Segmenter", "DpSegmenter");
    //pbuilder.init();
});

