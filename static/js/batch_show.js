var batch = null;


$(".recent_batch_link").live("click", function(event) {
        
    batch.setBatchId($(this).data("pk"));    
    event.preventDefault();
});

function populateBatchList(data) {
    var list = $("#recent_batches");
    var tbatch = $("<div></div>").addClass("recent_batch"); 
    var tlink = $("<a></a>").addClass("recent_batch_link");
    $.each(data.object_list, function(i, batch) {
        var link = tlink.clone()
            .attr("href", "/batch/show/" + batch.pk + "/")
            .data("pk", batch.pk)
            .text(batch.fields.name);
        list.append(tbatch.clone().append(link));        
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


