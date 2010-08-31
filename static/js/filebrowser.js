// class for browsing and selecting files on the server

function FileBrowser(container_id) {
    var m_container = $("#" + container_id);
    var m_dir = "";
    var m_lsurl = "/filebrowser/ls";
    var m_filedata = [];
    var m_initialised = false;

    // Header text against its index in the
    // file data tuple    
    var FNAME = 0;
    var FTYPE = 1;
    var FSIZE = 2;
    var FCMOD = 4;

    var m_headers = {
        "Name": FNAME,
        "Size": FSIZE,
        "Last Modified": FCMOD,    
    };
    var m_current = null;
    var m_sort = FNAME;
    var m_desc = false;

    // actual files selected
    var m_value = [];

    // alias 'this' for referencing from
    // within event callbacks etc.
    var self = this;



    /*
     *  Events
     */

    // double clicked directory entry
    $(".entry.dir").live("dblclick", function(e) {
        navDir($(this).data("name"));
    });

    // hit backspace key = go up a level
    $(window).keydown(function(event) {
        if (event.which == 8) {
            navUp();
        } else if (event.which == 13) {
            // navigate inside a single selected directory
            var seldirs = $(".entry.selected.dir");
            if (seldirs.length > 0) {
                navDir(seldirs.first().data("name"));
            }
        }
    });

    // sync the headers when container size changes
    m_container.resize(syncHeadWidths);


    // when the user clicks on a header separator, bind the mouse move
    // event to resize the columns of both header and entry tables.
    $(".header_drag").live("mousedown", function(event) {
        var head = $(this).parent();
        var cell = $($("#entrytable").find("td").get(head.data("index")));
        var leftpos = head.offset().left;
        // Note: using event namespaces here to add/remove the
        // correct events to the document.  This allows us the
        // move the mouse anywhere and be sure of not missing
        // the mouseup event
        $(document).bind("mouseup.headsize", function(upevent) {
            $(document)
                .unbind("mousemove.headsize")
                .unbind("mouseup.headsize")
                .css("cursor", "auto");
        }); 
        $(document).bind("mousemove.headsize", function(moveevent) {            
            var celldiff = cell.outerWidth(true) - cell.width();
            cell.width(moveevent.pageX - leftpos - celldiff);
            syncHeadWidths();
        });
        event.preventDefault();
    });

    // highlight the header when the mouse is down.
    $("th").live("mousedown", function(event) {
        var cell = $(this);
        cell.addClass("pressed");
        $(document).bind("mouseup.press", function(mue) {
            cell.removeClass("pressed");
            $(document).unbind("mouseup.press");
        });
    });


    // re-sort the list when the user clicks a column header
    $("th").live("click", function(event) {
        if (m_sort == $(this).data("sort")) {
            m_desc = !m_desc;
        } else {
            m_sort = $(this).data("sort");
            m_desc = false;
        }
        $(".sort_arrow").removeClass("order").removeClass("order_desc");
        $(this).find(".sort_arrow").addClass(m_desc ? "order_desc" : "order");
        m_filedata.sort(directoryFirstSort);
        updateFileList();
    });


    // don't allow selecting the list - it looks bad and makes
    // working with item selections dodgy
    $(".entry, th").live("mousedown", function(e) { return false; });
    

    // handle task selection and multiselection
    $(".entry").live("click", function(event) {
        var id = $(this).attr("id");

        // if ctrl is down TOGGLE selection, else select item
        selectEntry($(this), event.ctrlKey 
            ? !$(this).hasClass("selected") 
            : true
        );

        // if shift is down, select up the page
        if (event.shiftKey) {
            // deselect everything
            $(".selected").not($(this)).not(m_current).removeClass("selected");
            // if there's a current element and it's not the
            // one we've just clicked on, select everything in between
            if (m_current && $(m_current).get(0) != this) {
                var traverser = parseInt($(m_current).data("index")) >
                    parseInt($(this).data("index")) 
                    ? "nextUntil"
                    : "prevUntil";
                $(this)[traverser](m_current).each(function(i, elem) {
                    selectEntry($(elem), true);                        
                });
            }
        // if ctrl is down, don't clear the last selection 
        } else if (!event.ctrlKey) {
            $(".selected").each(function(i, entry) {
                if ($(entry).attr("id") != id) {
                    selectEntry($(entry), false);
                }
            });                                          
        }
        // store the selector of the current element
        // to use when selecting a range
        if (m_current == null || !event.shiftKey)
            m_current = "#" + $(this).attr("id");
        updateButtonState();
    });

    // Open button clicked
    $("#openbutton").live("click", function(event) {
        m_value = self.getValue();
        m_container.dialog("close");
        self.onClose(event);    
    });

    $("#cancelbutton").live("click", function(event) {
        if (m_container.dialog("isOpen")) {
            m_container.dialog("close");
        }
    });

    this.init = function() {
        m_container.html("");
        m_value = [];
        m_container.append(buildUi());
        self.refresh();
    }

    this.onClose = function(event) {

    }

    this.showModal = function(options) {
        self.init();
        m_container.dialog({
            width: 700,
            minHeight: 500,
            resize: function(e, ui) {
                syncHeadWidths();
            },
            close: function(e) {
                m_container.html("");
            },            
            modal: true,
        });
        // HACK!  Can't work how to achieve these styling
        // bits without munging the dialog content css 
        // directly.  Obviously this is fragile
        $(".ui-dialog-content")
            .css("padding", "5px 2px 10px 2px")
            .css("margin-top", "0px")
            .css("overflow", "hidden");
    }


    this.getValue = function() {
        if (m_container.dialog("isOpen")) {
            m_value = [];
            $(".selected.file").each(function(i, item) {
                if (m_dir == "") {
                    m_value.push($(item).data("name"));
                } else {
                    m_value.push(m_dir + "/" + $(item).data("name"));
                }
            });
        }        
        return m_value;
    }


    this.refresh = function() {
        $.ajax({
            url: m_lsurl,
            dataType: "json",
            data: "dir=" + m_dir,
            beforeSend: function(e) {
                self.setWaiting(true);
                $(".entry").hide();
            },
            complete: function(e) {
                self.setWaiting(false);
                $(".entry").removeClass("selected");
            },
            success: function(data) {
                if (data.error) {
                    alert("Error: " + data.error);
                    return;
                }
                m_filedata = data;
                m_filedata.sort(directoryFirstSort);
                updateFileList();
                $("#headtable").trigger("click");
            },
            error: function(xhr, error) {
                alert(error);
            },
        });
    }


    this.resized = function(event) {
        syncHeadWidths();
    }

    this.setWaiting = function(wait) {
        m_container.toggleClass("waiting", wait);
    }


    var navDir = function(dir) {
        if (m_dir == "")
            m_dir = dir;
        else
            m_dir = m_dir + "/" + dir;
        self.refresh();            
    }


    var navUp = function() {
        if (m_dir == "")
            return;
        
        if (m_dir.match(/(.+)\/[^\/]+$/)) {
            m_dir = RegExp.$1;
        } else if (m_dir != "") {
            m_dir = "";
        }
        self.refresh();
    }


    // set the buttons disabled/enabled according to the
    // current filebrowser state
    var updateButtonState = function() {
        $("#openbutton").attr("disabled", $(".selected.file").length == 0);
    }


    // sort the file data entries depending on the
    // current sort value and whether or not we're
    // sorting ascending or descending.  Sort 
    // directories first under all circumstances.
    var directoryFirstSort = function(a, b) {
        if (a[FTYPE] == "dir" && b[FTYPE] != "dir")
            return -1;
        if (b[FTYPE] == "dir" && a[FTYPE] != "dir")
            return 1;
        if (m_sort == FSIZE || m_sort == FCMOD)
            if (!m_desc)
                return a[m_sort] - b[m_sort];        
            else
                return b[m_sort] - a[m_sort];        
        if (!m_desc)
            return b[m_sort] < a[m_sort] ? 1 : -1;
        else
            return a[m_sort] < b[m_sort] ? 1 : -1;
    }

    // set a task in the list selected and store it's id
    // so the selection can be preserved after refresh
    var selectEntry = function(entry, select) {
        entry.toggleClass("selected", select);
    }

    
    // update the data in the table when the file
    // data changes
    var updateFileList = function() {
        setTableLength(m_filedata.length);
        
        var entries = $(".entry");
        for (var i = 0; i < m_filedata.length; i++) {

            // there must be a better way of settings the date...
            var date = new Date();
            date.setTime(parseFloat(m_filedata[i][FCMOD]) * 1000);

            $(entries.get(i))
                .attr("class", "entry")
                .data("index", i)
                .attr("id", "file" + i)
                .addClass(m_filedata[i][FTYPE])
                .addClass(i % 2 ? "odd" : "")
                .data("name", m_filedata[i][FNAME])
                .find("td")
                .first().text(m_filedata[i][FNAME])
                .addClass("n")
                .next().text(reportSize(m_filedata[i][FSIZE]))
                .next().text(date.toString().replace(/GMT.+/, ""));            
        };
        $(".entry").show();
        syncHeadWidths();
    }


    // sync the header table's columns with the file list's widths
    var syncHeadWidths = function() {
        for (var i in [0, 1, 2]) {
            var head = $($("#headtable").find("th").get(i));
            var pad = head.outerWidth() - head.width();
            var w =  $($("#entrytable").find("td").get(i)).outerWidth(true) - pad;
            head.css("width", w);
        }
    }


    // insert the appropriate number of empty rows
    // into the filetable
    var setTableLength = function(length) {
        var row = $("<tr></tr>")
            .addClass("entry")
            .css("MozUserSelect", "none")
            .append($("<td></td>"))
            .append($("<td></td>"))
            .append($("<td></td>"));

        var entrytable = $("#entrytable");
        var entries = entrytable.find(".entry");
        var diff = entries.length - length;
        if (diff < 0) {
            while (diff++) {
                entrytable.append(row.clone());
            }
        } else {
            for (var i = length; i < entries.length; i++) {
                $(entries.get(i)).remove();
            }
        }
    }


    var buildUi = function(data) {
        // we need a separate table for the header because
        // we don't want it to scroll when the table does
        var entrytable = $("<table></table>")
            .addClass("filelist")
            .attr("id", "entrytable");

        var tablescroll = $("<div></div>")
            .attr("id", "tscroll")
            .append(entrytable);

        var innercontainer = $("<div></div>")
            .addClass("fbcontainer")
            .append(buildHeaderTable())
            .append(tablescroll)
            .append(buildButtonBar());
        return innercontainer;
    }


    var buildButtonBar = function() {
        var openbutton = $("<input type='button' />")            
                            .addClass("fbcontrol")
                            .attr("name", "confirm")
                            .attr("disabled", true)
                            .attr("value", "Open")
                            .attr("id", "openbutton");
        var cancelbutton = $("<input type='button' />")            
                            .addClass("fbcontrol")
                            .attr("name", "cancel")
                            .attr("value", "Cancel")
                            .attr("id", "cancelbutton");
        var buttonbar = $("<div></div>")
            .addClass("fbcontrols")
            .append(openbutton)
            .append(cancelbutton);
        return buttonbar;
    }


    var buildHeaderTable = function() {
        var headtable = $("<table></table>")
            .addClass("listhead")
            .attr("id", "headtable");
        var thead = $("<thead></thead>");
        var headrow = $("<tr></tr>");
        headtable.append(thead.append(headrow));
        
        var count = 0;
        $.each(m_headers, function(k, v) {
            var th = $("<th></th>")
                .text(k)
                .data("sort", v)
                .data("index", count);
            // add a dragger to all but the last column
            // TODO: fix the hard-coded header number
            if (count < 2) {
                th.append(
                    $("<div></div>").addClass("header_drag")
                        .append($("<div></div>").addClass("header_line"))
                );
            }
            var sortdiv = $("<div></div>").addClass("sort_arrow");
            if (m_sort == v) {
                sortdiv.addClass(m_desc ? "order_desc" : "order");
            }
            th.append(sortdiv);
            headrow.append(th);
            count++;
        });
        return headtable;
    }


    // translate size in bytes into a human-readable one
    var reportSize = function(size) {
        if (size < 1024)
            return size + " bytes";
        else if (size < 1024 * 1024)
            return (Math.round(size / 102.4) / 10) + " KB";
        else
            return (Math.round(size / 104857.6) / 10) + " MB";
    }    
}
