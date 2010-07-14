// A widget comprising two seadragon viewers (one hidden) which can
// be switched back and forth to compare A and B images.
// This class is to handle setting global seadragon defaults and
// managing behaviour.
// Depends on JQuery (and obviously SeaDragon)


function ImageWindow(container_id, config) {

    var A = "A";   // not sure about this!
    var B = "B";
    var S = "S";

    // basic config options
    config = config || {};
    var height = config.height || 500;
    var width  = config.width || 500;
    var label = config.label || "Viewer - Output A";
    var id = config.id || "imagewindow";

    // Seadragon config
    Seadragon.Config.imagePath = "/static/js/seadragon/img/";
    Seadragon.Config.maxZoomPixelRatio = 20;

    // indicate the current state...
    var showing = A;
    var activeout = A;

    // store paths since can't seem to work out how to get
    // them directly from the SD viewers
    var spath = null;
    var apath = null;
    var bpath = null;

    // viewer holders
    var sviewer = null;
    var aviewer = null;
    var bviewer = null;

    // Initialise HTML...
    var imgwindow = $("#" + container_id)
        .addClass("imagewindow_container");
    var imgheader = $("<div><div>")
        .addClass("imagewindow_header").attr("id", id + "_header")
        .text(label);
    var viewport = $("<div><div>")
        .addClass("imagewindow_viewport").attr("id", id + "_viewport")
        .height(height).css("overflow", "hidden");
    var portalholder = $("<div></div>");
    var aportal = $("<div></div>")
        .height(height)
        .css("margin-bottom", "20px")
        .addClass("imagewindow_portal").attr("id", id + "_portal_out_a");
    var bportal = $("<div></div>")
        .height(height)
        .css("margin-bottom", "20px")
        .addClass("imagewindow_portal").attr("id", id + "_portal_out_b");
    var sportal = $("<div></div>")
        .height(height)
        .addClass("imagewindow_portal").attr("id", id + "_portal_src");
    var overlay = $("<div></div>")
        .addClass("overlay")
        .attr("id", "overlayfg")
        .height(height)
        .css("float", "left")
        .css("margin-top", height + "px")
        .css("z-index", "100")
        .css("width", $("#" + container_id).width())
        .css("position", "relative");


    // overlay a spinner thing when waiting for something
    // to happen
    this.setWaiting = function(waiting) {
        overlay.css("margin-top", waiting
                ? "0px" 
                : height + "px");
    }


    // set the viewer title
    this.setTitle = function(text) {
        if (imgheader.text().match(/.+(\s-\s\w+)/)) {
            imgheader.text(text + RegExp.$1);
        } 
    }


    this.getCropRect = function() {
        if (!sviewer.isOpen() || !aviewer.isOpen()) {
            return;
        }

        //alert("Center (pixels): " +
        //            aviewer.viewport.getCenter().toSource());
    }


    // Portal sync functions - there must be an easier way to do this,
    // but we have to remove the event listeners before re-attaching
    // them when toggling the visible viewer, otherwise we get some
    // kind of dodgy feedback between animation events.
    function syncViewer(viewer, others) {
        for (i in others) {
            others[i].viewport.zoomTo(viewer.viewport.getZoom(), true);
            others[i].viewport.panTo(viewer.viewport.getCenter(), true);
        }
    }

    var syncOutA =  function(e) {
        syncViewer(aviewer, [sviewer, bviewer]);
    };

    var syncOutB =  function(e) {
        syncViewer(bviewer, [sviewer, aviewer]);
    };

    var syncSrc = function(e) {
        syncViewer(sviewer, [aviewer, bviewer]);
    };                                          

    // switch sync between the viewports...
    var syncToOutputA = function(e) {
        sviewer.removeEventListener("animation", syncSrc);
        bviewer.removeEventListener("animation", syncOutB);
        aviewer.addEventListener("animation", syncOutA);
    };

    var syncToOutputB = function(e) {
        sviewer.removeEventListener("animation", syncSrc);
        aviewer.removeEventListener("animation", syncOutA);
        bviewer.addEventListener("animation", syncOutB);
    };

    var syncToSource = function(e) {
        aviewer.removeEventListener("animation", syncOutA);
        aviewer.removeEventListener("animation", syncOutB);
        sviewer.addEventListener("animation", syncSrc);
    };


    // add HTML to the document and start up the seadragon viewers
    this.init = function() {
        imgwindow.append(imgheader).append(
            viewport.append(overlay).append(
            portalholder
                .append(aportal)
                .append(bportal)
                .append(sportal)
            )
        );

        // init the viewers...
        sviewer = new Seadragon.Viewer(sportal.attr("id"));
        aviewer = new Seadragon.Viewer(aportal.attr("id"));
        bviewer = new Seadragon.Viewer(bportal.attr("id"));
        syncToOutputA();    
    }


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

    // the path to source and output DZIs
    this.setSource = function(dzipath) {
        spath = dzipath;
        setViewerPath(sviewer, dzipath);
    }

    this.setOutput = function(dzipath) {
        bpath = apath ? apath : dzipath;
        apath = dzipath;
        setViewerPath(aviewer, apath);
        setViewerPath(bviewer, bpath);
    }

    this.setOutputA = function(dzipath) {
        apath = dzipath;
        setViewerPath(aviewer, dzipath);
        if (!bviewer.isOpen()) {
            setViewerPath(bviewer, dzipath);
        } 
    }

    this.setOutputB = function(dzipath) {
        bpath = dzipath;
        setViewerPath(bviewer, dzipath);
    }

    this.activePath = function() {
        if (showing == S) {
            return spath;
        } else if (showing == A) {
            return apath;
        } else if (showing == B) {
            return bpath;
        } else {
            throw Error("Invalid 'showing' flag: not one of A, B, or S");
        }
    }

    this.activeOutputPath = function() {
        if (activeout == A) {
            return apath;
        } else if (activeout == B) {
            return bpath;
        } else {
            throw Error("Invalid 'activeout' flag: not one of A or B");
        }
    }


    // close the viewer images
    this.close = function() {
        if (aviewer.isOpen()) {
            aviewer.close();
        }
        if (bviewer.isOpen()) {
            bviewer.close();
        }
        if (sviewer.isOpen()) {
            sviewer.close();
        }
    }


    // switch between viewers...
    var me = this;
    this.toggleSrc = function() {
        var marginshift = 0;
        var portalheight = aportal.outerHeight(true); 

        if (showing == A || showing == B) {            
            syncToSource();
            marginshift = 2 * portalheight;
            imgheader.text(imgheader.text().replace(/- \w+(\s[AB])?$/, "- Source"));
            showing = S;
        } else {
            activeout == A ? syncToOutputA() : syncToOutputB();
            marginshift = activeout == A ? 0 : portalheight;
            imgheader.text(imgheader.text().replace("- Source", "- Output " + activeout));
            showing = activeout;
        }
        portalholder.css("margin-top", "-" + marginshift + "px");
    }


    // switch between viewers...
    this.toggleAB = function() {
        var inactive = activeout == A ? B : A;
        var marginshift = 0;        
        var portalheight = aportal.outerHeight(true); 
        if (showing == S) {
            activeout = inactive;
        } else {
            if (activeout == A) {
                syncToOutputB();
                marginshift = portalheight;
                showing = B;
                activeout = B;
            } else {
                syncToOutputA();
                marginshift = 0;
                showing = A;
                activeout = A
            }
        }
        imgheader.text(imgheader.text().replace(/- \w+(\s[AB])?$/, "- Output " + activeout));
        portalholder.css("margin-top", "-" + marginshift + "px");
    }
}
