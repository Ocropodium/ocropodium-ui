
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

});
