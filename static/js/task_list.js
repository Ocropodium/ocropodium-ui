// Class encapsulating the OCR task list

function TaskList(list_container_id, param_container_id) {

    var list_container = $("#" + list_container_id);
    var param_container = $("#" + param_container_id);

    var headers = {
        page_name:  "File",
        user_id:  "User",
        updated_on:  "Last Update",
        status:  "Status",
    };

    var url = window.location.pathname;
    var showurl = "/ocrtasks/show/";
    var deleteurl = "/ocrtasks/delete/";

    // refresh timeout
    var timeout = -1;

    // hash of selected tasks
    var selected = {};
    var lastselected = null;

    // alias 'this' so we can refer to it within
    // other function closures
    var me = this;

    // events!
    //
    $(window).keydown(function(event) {
        if (event.keyCode == 46) {
            deleteTasks();
        } 
    });

    // don't allow selecting the list - it looks bad and makes
    // working with item selections dodgy
    $(".task_item").live("mousedown", function(e) { return false; });
    
    $("#autorefresh").change(function(e) {
        if ($(this).attr("checked")) {
            me.init();
        } else {
            if (timeout != -1) {
                clearTimeout(timeout);
                timeout = -1;
            }
        }
    });

    // when we check the 'All' status box, deselect any others
    $("input[type='checkbox'].filter_item").click(function(e) {
        if ($(this).attr("id") != "view_status_all") {
            $("#view_status_all").attr("checked", false);
        } else {
            $("input.filter_item[type=checkbox]:not(#view_status_all)")
                .attr("checked", false);
        }
        me.init();
    });        

    // update the list when the user changes
    $("select.filter_item").change(function(e) {
        me.init();
    });

    
    $(".task_item").live("dblclick", function(event) {
        showTask($(this));    

    });

    // clear button clicked
    $("#clear_tasks").click(function(event) {
        deleteTasks();
    });    

    // handle task selection and multiselection
    $(".task_item").live("click", function(event) {
        var id = $(this).attr("id");
        if (selected[id]) {
            selectTask($(this), false);
        } else {
            selectTask($(this), true);

            // if shift is down, select up the page
            if (event.shiftKey) {
                if (lastselected) {
                    var traverser = parseInt($(lastselected).data("index")) >
                        parseInt($(this).data("index")) 
                        ? "nextUntil"
                        : "prevUntil";
                    $(this)[traverser](lastselected).each(function(i, elem) {
                        selectTask($(elem), true);                        
                    });
                }
            // if ctrl is down, don't clear the last selection 
            } else if (!event.ctrlKey) {
                $.each(selected, function(k, v) {
                    if (k != id) {
                        selectTask($("#" + k), false);
                    }
                });
            }
            // store the selector of the current element
            // to use when selecting a range
            lastselected = "#" + $(this).attr("id");
        }
        updateButtonState();
    });


    // sort the table when clicking on a header.  If the order
    // is already the current order, then reverse it by 
    // prepending "-" to the param name (a horrible implementation
    // detail...)
    $(".sort_table").live("click", function(e) {
        var curorder = document.filter.order_by.value;
        var order = getUrlVars($(this).attr("href")).order_by;
        if (curorder == order) {
            order = order.match(/^-(.+)/) 
                ? Regexp.$1
                : "-" + order;
        }
        document.filter.order_by.value = order;
        me.init();
        return false;
    });


    // go to the next/prev page when clicking the pagination]
    // links
    $(".pagination > a").live("click", function(e) {
        var page = getUrlVars($(this).attr("href")).page;
        document.filter.page.value = page;
        me.init();
        return false;
    });


    // call the server for new list data and trigger a 
    // table refresh when it returns
    this.init = function() {
        if (timeout != -1) {
            clearTimeout(timeout);
            timeout = -1;
        }
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

    // indicate we're actually doing something
    this.setWaiting = function(wait) {
        //list_container.toggleClass("waiting", wait);
    }


    // pop up task details when the user double-clicks on a task
    var showTask = function(task) {
        $("#dialog_box")
            .load(
                showurl + $(task).attr("id").replace("task_", ""),
                null,
                function(data) {
                    $("#dialog_box").dialog({
                        width: 700,
                        modal: true,
                        title: "Task Details",                        
                    });
                }
            );
    }


    // delete a list of jquery objects via ajax...
    var deleteTasks = function() {
        var tasks = $(".task_item.selected");
        if (tasks.length == 0 || !confirm("Really delete " + 
                    tasks.length + " task" +
                    (tasks.length == 1 ? "?" : "s?"))) {
            return;
        }

        var params = $.map(tasks, function(t) {
            return "pk=" + $(t).attr("id").replace("task_", "");
        }).join("&");
        $.ajax({
            url: deleteurl,
            data: params,
            dataType: "json",
            type: "POST",
            beforeSend: function(e) {
                tasks.addClass("todelete");
                me.setWaiting(true);
            },
            success: function(data, status, xhr) {
                if (xhr.status == 201) {
                    alert("Some tasks could not be deleted (probably because you don't own them.)");
                }
                me.init();
            },
            complete: function(e) {
                me.setWaiting(false);
            },
        });
    }

    // set the button state after Stuff Happens
    var updateButtonState = function() {
        document.controls.clear.disabled = ($(".task_item.selected").length == 0);
    }

    
    var refreshList = function(data) {
        list_container.html("");        
        list_container.append(drawList(data.object_list))
        list_container.append(drawPaginators(data));
        updateButtonState();
        scheduleReload();
    }    

    // set a timer to reload the list in X seconds
    var scheduleReload = function() {
        if ($("#autorefresh").attr("checked")) {
            var time = parseFloat($("#autorefresh_time").val());
            if (isNaN(time)) {
                time = 2;
            }
            time = Math.max(1, time);
            timeout = setTimeout(me.init, time * 1000);
        }
    }


    // set a task in the list selected and store it's id
    // so the selection can be preserved after refresh
    var selectTask = function(task, select) {
        task.toggleClass("selected", select);
        if (select) {
            selected[task.attr("id")] = true;
        } else {
            delete selected[task.attr("id")];
        }
    }

    
    var drawPaginators = function(data) {
        if (!data.has_other_pages) {
            return;
        }
        var container = $("<div></div>").addClass("paginators"); 
        var pag = $("<div></div>")
            .addClass("pagination")
            .addClass("step_links");
        if (data.has_previous) {
            pag.append($("<a>Previous</a>")
                    .attr("href", url + "?page="
                        + data.previous_page_number));
        }
        pag.append($("<span></span>")
                .text("Page " + data.number + " of " + data.num_pages).html());
        if (data.has_next) {
            pag.append($("<a>Next</a>")
                    .attr("href", url + "?page="
                        + data.next_page_number));
        }
        return container.append(pag);
    }


    var drawList = function(task_list) {
        if (task_list.length == 0) {
            return $("<div></div>").text("No tasks found");
        }

        var table = $("<table></table")
            .attr("id", "task_list")
            .addClass("info_table");
        var headerrow = $("<tr></tr>")
            .addClass("header_row");

        table.append(headerrow);
        var headerlink = $("<a></a>").addClass("sort_table");
        $.each(headers, function(name, text) {
            var link = headerlink.clone().text(text)
                .attr("href", url + "?order_by=" + name);
            if (name == document.filter.order_by.value) {
                link.addClass("order");
            } else if ("-" + name == document.filter.order_by.value) {
                link.addClass("order_desc");
            }
            headerrow.append($("<th></th>").append(link));    
        });

        for (var i in task_list) {
            var task = task_list[i];
            var id = "task_" + task.pk;
            var row = $("<tr></tr>")
                .addClass("task_item")
                .attr("id", id)
                .data("index", i)
                .css("MozUserSelect", "none");
            row.append($("<td></td>").text(task.fields.page_name));
            row.append($("<td></td>").text(task.fields.user.fields.username));
            row.append($("<td></td>").text(task.fields.updated_on));
            row.append($("<td></td>")
                .text(task.fields.status)
                .addClass(task.fields.status.toLowerCase()) 
            );
            if (selected[id]) {
                row.addClass("selected");
            }
            table.append(row);            
        }
        return table;
    }

    // private function
    var getParameters = function() {
        var params = [];
        $("input[type='hidden'].filter_item").each(function(i, elem) {
            params.push($(elem).attr("name") + "=" + $(elem).val());
        });
        $("input[type='checkbox'].filter_item").each(function(i, elem) {
            if ($(elem).attr("checked")) {    
                params.push($(elem).attr("name") + "=" + $(elem).val());
            }
        });
        $("select.filter_item").each(function(i, elem) {
            if ($(elem).val()) {    
                params.push($(elem).attr("name") + "=" + $(elem).val());
            }
        });
        return params.join("&");
    }

    this.getParameters = function() {
        return getParameters();
    }



    // Read a page's GET URL variables and return them as an associative array.
    var getUrlVars = function(url) {
        url = url ? url :  window.location.href;
        var vars = [], hash;
        var hashes = url.slice(url.indexOf('?') + 1).split('&');
        for(var i = 0; i < hashes.length; i++)
        {
            hash = hashes[i].split('=');
            vars.push(hash[0]);
            vars[hash[0]] = hash[1];
        }
        return vars;
    }
}
