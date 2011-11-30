
var uploader = null,
    statusbar = null;

$(function() {

    $(".document-item").draggable();
    $(".document-list").selectable();    

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
        uploading: function() {
            statusbar.setWorking(true);
        },
        complete: function() {
            statusbar.setWorking(false);
        },
        uploadResult: function(data) {
            console.log("Loaded", data);
            var pid = JSON.parse(data.target.response).pid;
            $.ajax({
                url: "/documents/show_small/" + pid + "/",
                error: OcrJs.ajaxErrorHandler,
                success: function(data) {
                    $(".document-list").append($(data));
                }
            });
        },
    });

});
