// Class encapsulating the OCR task list

function TaskList(list_container_id, param_container_id) {

    var list_container = $("#" + list_container_id);
    var param_container = $("#" + param_container_id);

    var url = window.location.pathname;

    // refresh timeout
    var timeout = -1;

    // hash of selected tasks
    var selected = {};
    var lastselected = null;

    // public functions
    var me = this;

    // events!
    //
    $(window).keydown(function(event) {
        if (event.keyCode == 46) {
            var deltasks = $(".task_item.selected");
            if (deltasks.length > 0) {
                if (confirm("Really delete " + 
                        deltasks.length + " task" +
                        (deltasks.length == 1 ? "?" : "s?"))) {
                    deleteTasks(deltasks); 
                }
            }
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
    });

    $(".sort_table").live("click", function(e) {
        var curorder = document.filter.order_by.value;
        var order = getUrlVars($(this).attr("href")).order_by;
        if (curorder == order) {
            if (order.match(/^-(.+)/)) {
                order = Regexp.$1;
                $(this).addClass("order");
            } else {
                order = "-" + order;
                $(this).addClass("order_desc");
            }
        }
        document.filter.order_by.value = order;
        me.init();
        return false;
    });

    $(".pagination > a").live("click", function(e) {
        var page = getUrlVars($(this).attr("href")).page;
        document.filter.page.value = page;
        me.init();
        return false;
        if (timeout != -1) {
            cancelTimeout(timeout);
            timeout = -1;
        }
    });

    this.init = function() {
        if (timeout != -1) {
            clearTimeout(timeout);
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


    this.setWaiting = function(wait) {
        //list_container.toggleClass("waiting", wait);
    }


    // delete a list of jquery objects via ajax...
    var deleteTasks = function(tasks) {
        var params = $.map(tasks, function(t) {
            return "pk=" + $(t).attr("id").replace("task_", "");
        }).join("&");
        $.ajax({
            url: "/ocrtasks/delete/",
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

    
    var refreshList = function(data) {
        list_container.html("");        
        list_container.append(drawList(data.object_list))
        list_container.append(drawPaginators(data));
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
        return pag;
    }


    var drawList = function(task_list) {
        var table = $("<table></table")
            .attr("id", "task_list")
            .addClass("info_table");
        var headerrow = $("<tr></tr>")
            .addClass("header_row");
        headerrow.append($("<th></th>").append($("<a></a>")
                .addClass("sort_table")
                .text("File").attr("href", url + "?order_by=page_name")));
        headerrow.append($("<th></th>").append($("<a></a>")
                .addClass("sort_table")
                .text("User").attr("href", url + "?order_by=batch__user")));
        headerrow.append($("<th></th>").append($("<a></a>")
                .addClass("sort_table")
                .text("Last Update").attr("href", url + "?order_by=updated_on")));
        headerrow.append($("<th></th>").append($("<a></a>")
                .addClass("sort_table")
                .text("Status").attr("href", url + "?order_by=status")));
        table.append(headerrow);

        for (var i in task_list) {
            var task = task_list[i];
            var id = "task_" + task.pk;
            var row = $("<tr></tr>")
                .addClass("task_item")
                .attr("id", id)
                .data("index", i)
                .css("MozUserSelect", "none");
            row.append($("<td></td>").text(task.fields.page_name));
            row.append($("<td></td>").text(task.fields.batch.fields.user.fields.username));
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
            if ($(this).attr("checked")) {    
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
