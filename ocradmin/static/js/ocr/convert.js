//
// Handle drag and drop page conversions
//


var PAGES = [];
var POLLTIMER = -1;
var PENDING = {};

const MINFONTSIZE = 6;
const MAXFONTSIZE = 40;

var uploader = null;
//var pbuilder = null;
var formatter = null;



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
    $.each(["engine", "clean", "psegmenter", "cmodel", "lmodel"], function(index, item) {
        $.cookie(item, $("select[name=" + item + "]").attr("value"));     
    });

    // save the job names of the current pages...
    var jobnames = $.map(PAGES, function(page, i) {
        return page.pageName() + ":" + page.id();
    }).join(",");
    $.cookie("jobnames", jobnames, {expires: 7});
}


function loadState() {
    $.each(["engine", "clean", "psegmenter", "cmodel", "lmodel"], function(index, item) {
        var val = $.cookie(item);
        if (val) {
            $("select[name=" + item + "]").val(val);
        }
    });

    var jobnames = $.cookie("jobnames");
    if (jobnames) {
        $.each(jobnames.split(","), function(index, pagejob) {
            var pagename = pagejob.split(":")[0], jobname = pagejob.split(":")[1];
            addPageToWorkspace(pagename, jobname);
        });
        pollForResults();
        layoutWidgets();
        updateUiState();
    }
}


function addPageToWorkspace(pagename, jobname) {
    var workspace = document.getElementById("workspace");
    var page = new OCRJS.PageWidget(workspace, pagename, jobname);
    PAGES.push(page);
    PENDING[jobname] = page;
    $(workspace).append(page.init());
    page.onLinesReady = function() {
        // trigger a reformat
        $("input[name=format]:checked").click();
    }
    page.onClose = function() {
        delete PENDING[page.id()];
        var temp = [];
        for (var i in PAGES) {
            if (page != PAGES[i])
                temp.push(PAGES[i])
        }
        PAGES = temp;
        updateUiState();
    }
}


function setResults(data) {
    for (var i in data) {
        var job = data[i];
        if (job.status == "PENDING")
            continue;
        var page = PENDING[job.job_name];
        if (!page) 
            continue;

        if (job.error || job.trace || job.status == "FAILURE") {
            page.setError(job.error, job.trace);
        } else if (job.status == "SUCCESS") {
            page.setResults(job.results);    
        }    
        delete PENDING[job.job_name];        
    };

    var count = 0;
    for (k in PENDING) if (PENDING.hasOwnProperty(k)) count++;
    if (count) {
        POLLTIMER = setTimeout(function() {
            pollForResults();
        }, 100);
    } else {
        POLLTIMER = -1;
    }
}

function pollForResults() {
    var tidstr = [];
    $.each(PENDING, function(tid, obj) {
        tidstr.push("job=" + tid);
    });
    if (!tidstr.length)
        return;
    $.ajax({
        url: "/ocr/results/",
        data: tidstr.join("&"),
        type: "GET",
        error: OCRJS.ajaxErrorHandler,
        success: setResults,
    });
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
    $.each(data, function(pagenum, results) {
        addPageToWorkspace(results.page_name, results.job_name);
    }); 
    if (POLLTIMER == -1)
        pollForResults();
    layoutWidgets();
    updateUiState();
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
    var pcount = PAGES.length;
    $(".tbbutton").button({disabled: pcount < 1});
    $(".ocr_page").css("font-size", $("#font_size").val() + "px");
}



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
    $("#clear").click(function(event) {
        PAGES = [];
        $(".ocr_page_container").remove();
        $.cookie("jobnames", null);
        updateUiState();
    });
    $("#download").click(function(event) {
        var jobnames = [];
        $.each(PAGES, function(i, page) {
            jobnames.push("task=" + page.id());
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
    $("select[name=engine]").change(function(e) {
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
        $("#optionsform input[type='text'], #optionsform select").each(function(i, elem) {
            uploader.registerTextParameter(elem);
        });
    };
    uploader.onUploadsFinished = function(e) {
        $("#dropzone").text("Drop images here...").removeClass("waiting"); 
    };

    // load state stored from last time
    loadState();
    
    // save state on leaving the page... at least try to...
    window.onbeforeunload = function(event) {
        try {
            saveState();
        } catch (msg) {
            alert(msg);
        }
    }


    // line formatter object
    formatter = new OCRJS.LineFormatter();

    // fetch the appropriate models...
    rebuildModelLists($("select[name=engine]").val());    

    // initialise the controls
    //pbuilder = new ParameterBuilder("options", ["ISegmentLine", "IGrouper"]);
    //pbuilder.registerComponent("grouper", "Grouper", "StandardGrouper");
    //pbuilder.registerComponent("segmenter", "Line Segmenter", "DpSegmenter");
    //pbuilder.init();
});

