var batch = null;
$(function() {

    $("#batch_manage").accordion();

    function hashNavigate() {
        if (document.location.hash.match(/^(#task(\d+))/)) {
            var taskid = RegExp.$1;
            var taskpk = RegExp.$2;
            var sel = $(taskid);
            var pk = sidebar.data("task_pk");
            if (sel.length && pk != taskpk)
                sel.click();
        }
    }

    function clearTaskDetails() {

    }


    function loadTaskDetails(index, pk) {
        $.ajax({
            url: "/ocrtasks/show/" + pk + "/",
            type: "get",
            success: function(data) {
                var html = $(data);
                sidebar.data("task_pk", pk);
                var loaded = false;
                $.getJSON("/ocr/task_config/" + pk + "/", function(data) {
                    sidebar.html(html);
                    sidebar.find("#tabs")
                        .accordion({
                            collapsible: true,
                            autoHeight: false,
                            active: parseInt(selectedtab),
                            change: function(event, ui) {
                                selectedtab = ui.options.active;
                                $.cookie("selectedtab", selectedtab);
                            },
                        });
                    loaded = true;
                    header.text("Task #" + pk);
                });
            },
        });
    }

    if ($("#batch_id").length) {
        batch = new OcrJs.BatchWidget(
                document.getElementById("batchcontainer"),
                $("#batch").data("index"));
        batch.addListeners({
            onTaskSelected: function() {
                 loadTaskDetails();
            },
            onTaskDeselected: function() {
                clearTaskDetails();                
            },
            onUpdate: function() {
                
            },
        }).startup();

        $(".submit_update").live("click", function(event) {
            var button = $(this);
            button.attr("disabled", true);
            var pk = sidebar.data("task_pk");
            if (!pk)
                return;
            $.ajax({
                url: "/ocr/update_task/" + pk + "/",
                type: "post",
                data: sideparams.serializedData(),
                success: function(resp) {
                    $(button).attr("disabled", false);
                    if (button.attr("id").search("rerun") != -1) {
                        $.post("/ocrtasks/retry/" + pk + "/");
                        batch.triggerRefresh();
                    }
                },
            });
            return false;
        });
    }
});


