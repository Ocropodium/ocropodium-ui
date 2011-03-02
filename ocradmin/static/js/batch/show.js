var batch = null;


$(".recent_batch_link").live("click", function(event) {
        
    batch.setBatchId($(this).data("pk"));    
    event.preventDefault();
});


function populateBatchList(data) {
    var list = $("#recent_batches");
    var tbatch = $("<div></div>").addClass("recent_batch");
    var titem = $("<span></span>"); 
    var tlink = $("<a></a>").addClass("recent_batch_link");
    var ttran = $("<a></a>").addClass("button");
    $.each(data.object_list, function(i, batch) {
        var span = titem.clone();
        var link = tlink.clone()
            .attr("href", "/batch/show/" + batch.pk + "/")
            .data("pk", batch.pk)
            .text(batch.fields.name);
        var trans = ttran.clone()
            .attr("href", "/batch/transcript/" + batch.pk + "/")
            .css("float", "right")
            .data("pk", batch.pk)
            .text("Transcript");
        list
            .append(tbatch.clone().append(span.append(trans).append(link)))
            .textOverflow("...");        
    });
}

$(function() {
    if ($("#batch_id").length) {
        var selectedtab = 0;
        batch = new OCRJS.BatchWidget($("#workspace").get(0), $("#batch_id").val());
        batch.onTaskSelected = function(index, pk) {
            $("#recent_batches").load("/ocrtasks/show/" + pk + "/", function() {
                var elem = this;
                console.log("selecting: ", selectedtab);
                var tabs = $(elem)                    
                        .find("#tabs")
                        .accordion({
                            collapsible: true,
                            autoHeight: false,
                            active: selectedtab,
                            change: function(event, ui) {
                                selectedtab = ui.options.active; 
                            },
                        });
                var params = null;
                $.getJSON("/ocr/task_config/" + pk + "/", function(data) {
                    console.log("Set task data...");
                    params = new OCRJS.ParameterBuilder(
                            $(elem).find("#options").get(0), data);
                    params.init();
                });
            });
        };
        batch.init();
    
        $.ajax({
            url: "/batch/list?order_by=-created_on",
            data: {},
            dataType: "json",
            error: OCRJS.ajaxErrorHandler,
            success: populateBatchList,
        });
    }

});        


