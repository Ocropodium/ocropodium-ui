$(function() {
    
    var XHRQUEUE = [];
    var BOUNDARY = '------multipartformboundary' + (new Date).getTime();
    var DASHDASH = '--';
    var CRLF     = '\r\n';
    var NUMFILES = 1;



    /* Display uploaded files. */
    //$("#dropzone").load("list.php");
    
    /* We cannot use $.bind() since jQuery does not normalize the native events. */
    $('#dropzone')
        .get(0)
        .addEventListener('drop', upload, false);
    $('#dropzone')
        .get(0)
        .addEventListener('dragenter', function(event) { 
                $('#dropzone').css("background-color", "#ffc"); 
            }, false);
    $('#dropzone')
        .get(0)
        .addEventListener('dragexit', function(event) { 
                $('#dropzone').css("background-color", "#fff"); 
            }, false);
    $('#dropzone')
        .get(0)
        .addEventListener('dragover', function(event) { 
                event.preventDefault(); 
            }, false);

    $(".ocr_line").live("click", function(e) {
            //alert("clicked!");
    });

    $("#singleupload").change(function(event) {
        if ($(this).val() == "") {
            return false;
        }
        $("#uploadform").submit();
    });

    $("#uploadform").submit(function(event) {
        return AIM.submit(this, {
            'onStart' : function(e) {
                // make something useful before submit (onStart)
                $("#dropzone").text("Please wait...").addClass("waiting");
                $("#pageout").html("");
         		return true;
            },                                     
            'onComplete' : onXHRLoad,
        });
    });


    function pollForResults(element) {
        var jobname = element.data("jobname");
        $.getJSON(
            "/ocr/results/" + jobname,
            function (data) {
                if (data.error) {
                    $("#binary_out_head").removeClass("waiting");
                    element
                        .addClass("error")
                        .html("<h4>Error: " + data.error + "</h4>")
                        .append(
                            $("<div></div>").addClass("traceback")
                                .append("<pre>" + data.trace + "</pre>")                                
                        );                            
                } else if (data.status == "SUCCESS") {
                    // set up the zoom slider according to the scale
                    //$("#zoom").slider({"min": data.results.scale});

                    element.data("src", data.results.src);
                    element.data("dst", data.results.dst);
                    if (binviewer.isOpen()) {
                        var center = binviewer.viewport.getCenter();
                        var zoom = binviewer.viewport.getZoom();
                        binviewer.openDzi(data.results.dst);
                        srcviewer.openDzi(data.results.src);
                        binviewer.addEventListener("open", function(e) {
                            binviewer.viewport.panTo(center, true); 
                            binviewer.viewport.zoomTo(zoom, true); 
                        });
                    } else {
                        binviewer.openDzi(data.results.dst);
                        srcviewer.openDzi(data.results.src);
                    }
                    $("#binary_out_head").removeClass("waiting");
                } else if (data.status == "PENDING") {
                    setTimeout(function() {
                        pollForResults(element);
                        }, 500);
                } else {
                    element.html("<p>Oops, task finished with status: " + data.status + "</p>");
                }
            }
        ); 
    }

    // toggle the source and binary images
    $("#togglesrc").click(function(e) {
        if ($("#binary_out").css("margin-top") != "-560px") {
            $("#binary_out").css("margin-top", "-560px");
        } else {
            $("#binary_out").css("margin-top", "0px"); 
        }
    });

    // resubmit the form...
    $("#refresh").click(function(e) {
        
        var params = "&src=" + $("#binary_out").data("src") 
            + "&dst=" + $("#binary_out").data("dst")
            + "&" + $("#optionsform").serialize();
        $.post("/ocr/binarize", params, function(data) {
            $(".ocr_page").each(function(index, pdiv) {
                $(this).data("jobname", data[index].job_name);
                pollForResults($(this));
            });
        });
    });

    function onXHRLoad(event_or_response) {
        var data;
        if (typeof(event_or_response) != "string") {
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
            data = $.parseJSON(event_or_response);
            $("#singleupload").val("");
            
        }

        if (data.error) {
            alert("Error: " + data.error + "\n\n" + data.trace);
            $("#dropzone").text("Drop images here...").removeClass("waiting");
            return;
        }


        $.each(data, function(page, pageresults) {
            var pagename = pageresults.job_name.split("::")[0].replace(/\.[^\.]+$/, "");
            $("#binary_out_head").text(pagename).addClass("waiting");
            $("#binary_out")
                .data("jobname", pageresults.job_name);
            pollForResults($("#binary_out"));
        }); 
        if (XHRQUEUE.length) {
            var fxhr = XHRQUEUE.shift();
            fxhr.open("POST", "/ocr/binarize?nohang=1", true);
            fxhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
            fxhr.setRequestHeader('content-type', 'multipart/form-data; boundary=' + BOUNDARY); 
            fxhr.sendAsBinary(fxhr.builder);
        } else {
            $("#dropzone").text("Drop images here...").removeClass("waiting"); 
        }
    };


    function upload(event) {
        
        var data = event.dataTransfer;
        for (var i = 0; i < data.files.length; i++) {
            if (data.files[i].type.search("image/") == -1) {
                alert("Error: invalid file type: " + data.files[i].type);
                event.stopPropagation();
                return;
            }
        }
        // set the global NUMFILES variable
        NUMFILES = data.files.length;
  
        /* Show spinner for each dropped file and say we're busy. */
        $("#dropzone").text("Please wait...").addClass("waiting");

        try {
            var textparams = {
                engine: $("input[@name=engine]:checked").val(),
                pseg: $("#form_segmenter").val(),
                twidth: $("#binary_out").width(),   
            }
        } catch (err) {
            alert(err);
        } 

        $("#optionsform input, #optionsform select").each(function() { 
            textparams[$(this).attr("name")] = $(this).val();
        });

        for (var i = 0; i < data.files.length; i++) {
            var file = data.files[i];
            var binaryReader = new FileReader();    
            /* Build RFC2388 string. */
            var builder = '';
            builder += DASHDASH;
            builder += BOUNDARY;
            builder += CRLF;

            /* append text param values */
            $.each(textparams, function(key, value) {
                builder += 'Content-Disposition: form-data; name="' + key + '"; ';
                builder += 'Content-Type: text/plain';
                builder += CRLF;
                builder += CRLF;
                builder += value;
                builder += CRLF;
                builder += DASHDASH;
                builder += BOUNDARY;
                builder += CRLF;
            });
            
            /* Generate headers. */            
            builder += 'Content-Disposition: form-data; ';
            builder += 'name="userfile' + i + '[]"';
            if (file.fileName) {
              builder += '; filename="' + file.fileName + '"';
            }
            builder += CRLF;
 
            builder += 'Content-Type: ' + file.type;
            builder += CRLF;
            builder += CRLF; 
 
            /* Append binary data. */
            builder += file.getAsBinary() ;//binaryReader.readAsBinaryString(file);
            builder += CRLF;
 
            /* Write BOUNDARY. */
            builder += DASHDASH;
            builder += BOUNDARY;
            builder += CRLF;
        
            /* Mark end of the request. */
            builder += DASHDASH;
            builder += BOUNDARY;
            builder += DASHDASH;
            builder += CRLF;
            try {
                var xhr = new XMLHttpRequest();
                xhr.builder = builder;
                xhr.onload = onXHRLoad;
                XHRQUEUE.push(xhr);
            } catch (e) {
                alert(e);
            }
        }
        if (XHRQUEUE.length) {
            var fxhr = XHRQUEUE.shift();
            fxhr.open("POST", "/ocr/binarize", true);
            fxhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
            fxhr.setRequestHeader('content-type', 'multipart/form-data; boundary=' + BOUNDARY); 
            fxhr.sendAsBinary(fxhr.builder);
        }

        /* Prevent FireFox opening the dragged file. */
        event.stopPropagation();
        
    }


    buildComponentOptions();
    $(".binoption").live("change", function(e) {
        reinitParams($(this));
    });
});


function reinitParams(binselect) {
    var compname = binselect.val();
    var paramlabel = $("<label></label>");
    var paraminput = $("<input type='text'></input>");
    var pdiv = binselect.next();
    if (pdiv.attr("tagName") == "DIV") {
        pdiv.html("");
        pdiv.remove();
    }
    // that'll do if we're just removing the component 
    if (compname == "") {
        return;
    }
    
    var params = PARAMS[compname].params;
    if (params.length) {
        pdiv = $("<div></div>").attr("class", "compparam");
        $.each(params, function(index, param) {
            var plabel = paramlabel.clone()
                .attr("foo", binselect.val() + "_option")
                .text(param.name);
            var pinput = paraminput.clone()
                .attr("name", binselect.val() + "__" + param.name)
                .attr("value", param.value);
            pdiv.append(plabel).append(pinput);
            binselect.after(pdiv);
        });
    }
}


function setSingleOptionDefaults(components) {
    $.each(components["StandardPreprocessing"].params, function(index, param) {
        if (param.name == "binarizer") {
            $("#binarizer").attr("name", param.name).val(param.value);
        } else if (param.name == "graydeskew") {
            $("#graydeskew").attr("name", param.name).val(param.value);
        } else if (param.name == "bindeskew") {
            $("#bindeskew").attr("name", param.name).val(param.value);
        }
    });
}

function setMultiOptionDefaults(components, bincleansel, graycleansel) { // FIXME: Stupid params!
    $.each(components["StandardPreprocessing"].params, function(index, param) {
        if (param.value) {
            var cselect;
            if (param.name.search("grayclean") != -1) {
                cselect = graycleansel.clone();
            } else if (param.name.search("binclean") != -1) {
                cselect = bincleansel.clone();
            }
            if (cselect) {
                cselect.attr("name", param.name)
                    .val(param.value).attr("id", param.name);
                $("#options").append("<label>" + param.name + "</label>")
                    .attr("for", param.name);
                $("#options").append(cselect);
            }
        }
    });
}


function setupOptions(components) {

    var option = $("<option></option>");
    // build selects for each component type
    var baseselect = $("<select></select>").addClass("binoption");
    var binarizesel = baseselect.clone().attr("id", "binarizer");
    var bindeskewsel = baseselect.clone().attr("id", "bindeskew");
    var graydeskewsel = baseselect.clone().attr("id", "graydeskew");
    var bincleansel = baseselect.clone();
    var graycleansel = baseselect.clone();
        
    // add a blank option to some of them
    $.each([bincleansel, bindeskewsel, 
            graydeskewsel, graycleansel], function(index, item) {
        item.append(option.clone().attr("value", ""));
    });

    $.each(components, function(name, component) {
            var newopt = option.clone()
            .attr("value", component.name)
            .text(component.name);
        if (component.type == "IBinarize") {
            binarizesel.append(newopt);
        } else if (component.type == "ICleanupBinary") {
            if (component.name == "DeskewGrayPageByRAST") {            
                graydeskewsel.append(newopt);
            } else if (component.name == "DeskewPageByRAST") {
                bindeskewsel.append(newopt);
                } else {
                //alert("Adding to binclean: " + component.name);
                bincleansel.append(newopt); 
            }
        } else if (component.type == "ICleanupGray") {
            graycleansel.append(newopt);
        }
    });

    $("#options").append("<label>Binarizer</label>").attr("for", "binarizer");
    $("#options").append(binarizesel);
    $("#options").append("<label>Deskew Grayscale</label>").attr("for", "graydeskew");
    $("#options").append(graydeskewsel);
    $("#options").append("<label>Deskew Binary</label>").attr("for", "bindeskew");
    $("#options").append(bindeskewsel);

    // set options and defaults on multi-value options (binclean, grayclean)
    setMultiOptionDefaults(components, bincleansel, graycleansel);

    // set the remaining defaults to those listed in StandardPreprocessing...
    setSingleOptionDefaults(components);        

    // add appropriate options for components
    layoutOptions(components);
}


function layoutOptions(components) {
    var paramdiv = $("<div></div>").addClass("compparam");
    var paramlabel = $("<label></label>");
    var paraminput = $("<input type='text'></input>");
    // lay out parameter...
    var sp = components["StandardPreprocessing"];
    $.each(sp.params, function(index, param) {
        var paramname = param.name;
        var cselect = $("select.binoption#" + paramname);
        var compname = cselect.val();
        if (compname) {
            var component = components[compname];
            var compparams = component.params;
            var pdiv = paramdiv.clone().attr("id", cselect.attr("id") + "_options");
            $.each(compparams, function(index, param) {
                var paramname = compname + "__" + param.name;
                var plabel = paramlabel.clone()
                    .attr("for", paramname)
                    .text(param.name);
                var pinput = paraminput.clone()
                    .attr("name", paramname)
                    .attr("id", paramname)
                    .val(param.value);
                pdiv.append(plabel).append(pinput);
                cselect.after(pdiv);            
            });
        }
    });
}

var PARAMS = {}; // sorry, global.

function buildComponentOptions() {
    // get the component data for the types we want
    var types = ["IBinarize", "ICleanupBinary", "ICleanupGray"];
    // returns a list component hashes
    $.getJSON("/ocr/components", types.join("&"), function(components) {
        PARAMS = components;
        setupOptions(components);        
    });
}


// init the seadragon viewer
var binviewer = null;
var srcviewer = null;

function syncViewer(viewer, other) {
    if (!viewer.isOpen() || !other.isOpen()) {
        return;
    }
    other.viewport.zoomTo(viewer.viewport.getZoom(), true);
    other.viewport.panTo(viewer.viewport.getCenter(), true);
}

function initViewers() {
    Seadragon.Config.animationTime = 1.5;
    Seadragon.Config.blendTime = 0.5;
    Seadragon.Config.maxZoomPixelRatio = 3;

    srcviewer = new Seadragon.Viewer("source_out");
    binviewer = new Seadragon.Viewer("binary_out");
    binviewer.addEventListener("animation", function(e) {
        syncViewer(binviewer, srcviewer);
    });
    srcviewer.addEventListener("animation", function(e) {
        syncViewer(srcviewer, binviewer);
    });
} 

$(function(e) {
    initViewers();
});

