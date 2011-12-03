
var uploader = null,
    statusbar = null;

$(function() {

    // map of key commands to functions
    var cmdmap = {
        "ctrl+del": function() { 
            deleteSelected();
        },
    };

    function bindKeys() {
        $.each(cmdmap, function(key, handler) {
            $(document).bind("keydown.keycmd", key, function(event) {
                handler();
                event.stopPropagation();
                event.preventDefault();
            });
        });
    }

    function deleteSelected() {
        var sel = $.map($(".document-selector.ui-selected"), function(elem, i) {
            return "pid=" + $(elem).closest(".document-item").attr("id");
        });
        if (confirm("Delete " + sel.length + " documents?")) {
            $.ajax({
                url: "/documents/delete_multiple/?" + sel.join("&"),
                type: "POST",
                dataType: "json",
                error: OcrJs.ajaxErrorHandler,
                success: function(data) {
                    $(".document-list").load("/documents/list", function() {
                        makeSelectable();
                    });
                }
            });
        }
    }

    //$(".document-item").draggable();
    function makeSelectable() {
        $(".document-list").selectable({
            filter: ".document-selector",
            cancel: ".document-thumb, .document-details", 
        });    
    }

    function drop(e) {
        ignoreDrag(e);
        var dt = e.originalEvent.dataTransfer;
        var files = dt.files;

        if(dt.files.length > 0){
            for (var i = 0; i < dt.files.length; i++)
                console.log(dt.files[i]);
        }
    }

    function ignoreDrag(e) {
        e.originalEvent.stopPropagation();
        e.originalEvent.preventDefault();
    }

    $('#mainwidget')
        .bind('dragenter', ignoreDrag)
        .bind('dragover', ignoreDrag)
        .bind('drop', drop);

    uploader = new OcrJs.AjaxUploader($(".document-list").get(0),
            "/documents/create_ajax/", {
                fakeinput: false,
            });

    statusbar = new OcrJs.StatusBar($("#status_bar").get(0));

    uploader.addListeners({
        hoverOver: function() {
            $(".document-list").addClass("dragover");    
        },
        hoverOut: function() {
            $(".document-list").removeClass("dragover");    
        },
        drop: function() {
            $(".document-list").removeClass("dragover");    
        },
        uploading: function() {
            statusbar.setWorking(true);
        },
        complete: function() {
            statusbar.setWorking(false);
        },
        uploadResult: function(data, filename, filetype) {
            var pid = JSON.parse(data.target.response).pid;
            $.ajax({
                url: "/documents/show_small/" + pid + "/",
                error: OcrJs.ajaxErrorHandler,
                success: function(html) {
                    $(".document-list").append($(html));
                    makeSelectable();
                }
            });
        },
    });
    makeSelectable();
    bindKeys();

    $(".document-thumb-link").lightBox({
        imageLoading: '/static/lightbox-ico-loading.gif',
	    imageBtnClose: '/static/lightbox-btn-close.gif',
    	imageBtnPrev: '/static/lightbox-btn-prev.gif',
    	imageBtnNext: '/static/lightbox-btn-next.gif',        
        imageBlank: '/static/lightbox-blank.gif',
        maxWidth: 800,
        maxHeight: 600,
        containerResizeSpeed: 150,
    });
});
