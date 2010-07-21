// Class encapsulating the OCR task list

function TaskList(list_container_id, param_container_id) {

    var list_container = $("#" + list_container_id);
    var param_container = $("#" + param_container_id);

    var url = "/ocrtasks/list2";

    // public functions
    var me = this;

    this.init = function() {

        $.ajax({
            url: url,
            dataType: "json",
            data: getParameters(),
            beforeSend: function(e) { me.setWaiting(true) },
            complete: function(e) {   me.setWaiting(false) },
            success: function(data) {
                refreshList(data);
            },
            error: function(xhr, error) {
                alert(error);
            },
        });
    }


    this.setWaiting = function(wait) {
        list_container.toggleClass("waiting", wait);
    }

    
    var refreshList = function(data) {
        
        var table = $("<table></table")
            .attr("id", "task_list")
            .addClass("info_table");

        var headerrow = $("<tr></tr>")
            .addClass("header_row");
        headerrow.append($("<th></th>").text("File"));
        headerrow.append($("<th></th>").text("User"));
        headerrow.append($("<th></th>").text("Last Update"));
        headerrow.append($("<th></th>").text("Status"));
        table.append(headerrow);

        for (var i in data.object_list) {
            var task = data.object_list[i];

            var row = $("<tr></tr>")
                
                .addClass("task_item")
                .attr("id", "task_" + task.pk);
            row.append($("<td></td>").text(task.fields.page_name));
            row.append($("<td></td>").text(task.fields.batch.fields.user.fields.username));
            row.append($("<td></td>").text(task.fields.updated_on));
            row.append($("<td></td>")
                .text(task.fields.status)
                .addClass(task.fields.status.toLowerCase()) 
            );
            table.append(row);            
        }
        list_container.append(table);



    }    




    // private function
    var getParameters = function() {
        var params = {};
        param_container.children("input, select").each(function(i, elem) {
            params[$(elem).attr("name")] = $(elem).val();
        });

        return params;
    }




}
