// A widget comprising two seadragon viewers (one hidden) which can
// be switched back and forth to compare A and B images.
// This class is to handle setting global seadragon defaults and
// managing behaviour.
// Depends on JQuery (and obviously SeaDragon)


function ImageWindow(container_id, config) {

    // basic config options
    config = config || {};
    var height = config.height || 500;
    var width  = config.width || 500;
    var label = config.label || "Viewer - Output";
    var id = config.id || "imagewindow";

    // Seadragon config
    Seadragon.Config.imagePath = "/static/js/seadragon/img/";


    // indicate the current state...
    var showingout = true;

    // Initialise HTML...
    var imgwindow = $("#" + container_id)
        .addClass("imagewindow_container");
    var imgheader = $("<div><div>")
        .addClass("imagewindow_header").attr("id", id + "_header")
        .text(label);
    var viewport = $("<div><div>")
        .addClass("imagewindow_viewport").attr("id", id + "_viewport")
        .height(height).css("overflow", "hidden")
    var outportal = $("<div></div>")
        .height(height)
        .css("margin-bottom", "20px")
        .addClass("imagewindow_portal").attr("id", id + "_portal_out");
    var srcportal = $("<div></div>")
        .height(height)
        .addClass("imagewindow_portal").attr("id", id + "_portal_src");
    var overlay = $("<div></div>")
        .addClass("overlay")
        .attr("id", "overlayfg")
        .height(height)
        .css("position", "relative");


    // viewer holders
    var srcviewer = null;
    var outviewer = null;


    // overlay a spinner thing when waiting for something
    // to happen
    this.setWaiting = function(waiting) {
        overlay.css("top", waiting
                ? "-" + ((2 * height) + 20) + "px"
                : "0px");
    }


    // set the viewer title
    this.setTitle = function(text) {
        if (imgheader.text().match(/.+(\s-\s\w+)/)) {
            imgheader.text(text + RegExp.$1);
        } 
    }


    // Portal sync functions - there must be an easier way to do this,
    // but we have to remove the event listeners before re-attaching
    // them when toggling the visible viewer, otherwise we get some
    // kind of dodgy feedback between animation events.
    function syncViewer(viewer, other) {
        if (!viewer.isOpen() || !other.isOpen()) {
            return;
        }
        other.viewport.zoomTo(viewer.viewport.getZoom(), true);
        other.viewport.panTo(viewer.viewport.getCenter(), true);
    }

    var syncOut =  function(e) {
        syncViewer(outviewer, srcviewer);
    };

    var syncSrc = function(e) {
        syncViewer(srcviewer, outviewer);
    };                                          

    // switch sync between the viewports...
    var syncSourceToOutput = function(e) {
        srcviewer.removeEventListener("animation", syncSrc);
        outviewer.addEventListener("animation", syncOut);
    };

    var syncOutputToSource = function(e) {
        outviewer.removeEventListener("animation", syncOut);
        srcviewer.addEventListener("animation", syncSrc);
    };



    // set the path to a viewer and wire it to switch back
    // to the original position and zoom...
    var setViewerPath = function(viewer, dzipath) {
        if (viewer.isOpen()) {
            var center = viewer.viewport.getCenter();
            var zoom = viewer.viewport.getZoom();
            viewer.addEventListener("open", function(e) {
                viewer.viewport.panTo(center, true); 
                viewer.viewport.zoomTo(zoom, true); 
            });
        }
        viewer.openDzi(dzipath);        
    }



    // add HTML to the document and start up the seadragon viewers
    this.init = function() {
        imgwindow.append(imgheader).append(
                    viewport.append(outportal).append(srcportal).append(overlay)
        );

        // init the viewers...
        srcviewer = new Seadragon.Viewer(srcportal.attr("id"));
        outviewer = new Seadragon.Viewer(outportal.attr("id"));
        syncSourceToOutput();    
    }


    // the path to source and output DZIs
    this.setSource = function(dzipath) {
        setViewerPath(srcviewer, dzipath);
    }

    this.setOutput = function(dzipath) {
        setViewerPath(outviewer, dzipath);
    }


    // close the viewer images
    this.close = function() {
        if (outviewer.isOpen()) {
            outviewer.close();
        }
        if (srcviewer.isOpen()) {
            srcviewer.close();
        }
    }


    // switch between viewers...
    this.toggle = function() {
        if (showingout) {
            syncOutputToSource();
            outportal.css("margin-top", "-" 
                    + outportal.outerHeight(true) + "px");
            imgheader.text(imgheader.text().replace("- Output", "- Source"));
            showingout = false;
        } else {
            syncSourceToOutput();
            outportal.css("margin-top", "0px");            
            imgheader.text(imgheader.text().replace("- Source", "- Output"));
            showingout = true;
        }
    }
}



