
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

    function getSelectedPids() {
        return $.map($(".document-selector.ui-selected"), function(elem, i) {
            return $(elem).closest(".document-item").attr("id");
        });
    }

    function deleteSelected() {
        var sel = $.map(getSelectedPids(), function(p, i) {
            return "pid=" + p;
        });
        if (confirm("Delete " + sel.length + " documents?")) {
            $.ajax({
                url: "/documents/delete_multiple/?" + sel.join("&"),
                type: "POST",
                dataType: "json",
                error: OcrJs.ajaxErrorHandler,
                success: function(data) {
                    $(".document-list").load("/documents/list", function() {
                        addDynamicActions();
                    });
                }
            });
        }
    }

    //$(".document-item").draggable();
    function addDynamicActions() {
        $(".document-list").selectable({
            filter: ".document-selector",
            cancel: ".document-thumb, .document-details",
            stop: function() {
                updateButtons();
            } 
        });    
        $(".button_link").button();
        $(".button_link.error, .button_link.initial").button({disabled: true});
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
    }

    function updateButtons() {
        var pids = getSelectedPids();
        $("#submit_batch_form").attr("disabled", pids.length < 1);
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

    uploader = new OcrJs.AjaxUploader($("#workspace").get(0),
            "/documents/create_ajax/", {
                fakeinput: false,
            });

    statusbar = new OcrJs.StatusBar($("#status_bar").get(0));

    $("#submit_batch_form").click(function(event) {
        var pids = getSelectedPids();
        $.each(pids, function(i, pid) {
            $("#create_batch_form").append(
                $("<input name='pid' type='hidden' value='" + pid + "' />"));
        });
        //$.ajax({
        //    url: "/documents/batch?" + pids.join("&"),
        //    type: "POST",
        //    data: {preset: $("#batch_preset").val()},
        //    dataType: "json",
        //    error: OcrJs.ajaxErrorHandler,
        //    success: function(data) {
        //        pollForResults(data.pk);
        //    }
        //});
        console.log($("#create_batch_form").html());
        $("#create_batch_form").submit();
        event.preventDefault();
        event.stopPropagation();
    });

    function pollForResults(batchpk) {
        alert("Polling for: " + batchpk);
    }

    uploader.addListeners({
        hoverOver: function() {
            $("#workspace").addClass("dragover");    
        },
        hoverOut: function() {
            $("#workspace").removeClass("dragover");    
        },
        drop: function() {
            $("#workspace").removeClass("dragover");    
        },
        uploading: function() {
            statusbar.setWorking(true);
        },
        complete: function() {
            statusbar.setWorking(false);
        },
        uploadResult: function(data, filename, filetype) {
            console.log($(data.target.response));
            $(".document-list").append($(data.target.response));
            addDynamicActions();
        },
    });
    addDynamicActions();
    bindKeys();

});
