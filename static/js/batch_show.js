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
        list.append(tbatch.clone().append(span.append(link).append(trans)));        
    });
}

$(function() {
    batch = new OcrBatch("workspace", $("#batch_id").val());    
    batch.init();

    $.ajax({
        url: "/batch/list?order_by=-created_on",
        data: {},
        dataType: "json",
        success: populateBatchList,
    });
});        


