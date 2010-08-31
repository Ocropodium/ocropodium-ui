// class for browsing and selecting files on the server

function AbstractListWidget() {
}

AbstractListWidget.prototype.init = function(parent, datasource, options) {
    this.parent = parent;   
    this.data = datasource;

    this.options = {
        multiselect: true,                     
    };
    $.extend(this.options, options);

    // currently selected list entry
    // (the last one clicked)
    this.__current = null;
    this.__selected = {};

    var self = this;
    this.data.addListener("dataChanged", function() {
        self.refreshEntries(); 
    });
    $(this.parent).html("");
    $(this.parent).append(this.buildUi());
    this.setupMouseEvents();
    this.data.refreshData();
}

AbstractListWidget.prototype.dataSource = function() {
    return this.data;
}

AbstractListWidget.prototype.addListener = function(key, func) {
    if (this.__listeners[key] == undefined)
        throw "Unknown callback: '" + key + "'";
    this.__listeners[key].push(func);
}

AbstractListWidget.prototype.callListeners = function() {
    var args = Array.prototype.slice.call(arguments);
    var key = args.shift();
    $.each(this.__listeners[key], function(i, func) {
        func.apply(func.callee, args.concat(Array.prototype.slice.call(arguments)));
    });
}

AbstractListWidget.prototype.setupMouseEvents = function() {

    var self = this;

    // sync the headers when container size changes
    $(this.parent).resize(function() {
        self.syncHeadWidths();
    });

    // sort when the header is clicked
    function headSort(event) {
        self.data.sortByColumn($(this).data("index"));
        $(".sort_arrow").removeClass("order").removeClass("order_desc");
        $(this).find(".sort_arrow").addClass(
            self.data.descending() ? "order_desc" : "order");
    }
    // re-sort the list when the user clicks a column header
    $("th").bind("click.headsort", headSort);

    // we don't want to sort the headers 
    $(".header_drag").bind("mouseover mouseout", function(event) {
        if (event.type == "mouseover") {
            $("th").unbind("click.headsort");
        } else {
            $("th").bind("click.headsort", headSort);
        }
    });


    // when the user clicks on a header separator, bind the mouse move
    // event to resize the columns of both header and entry tables.
    $(".header_drag").bind("mousedown", function(event) {
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
            self.syncHeadWidths();
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


    // don't allow selecting the list - it looks bad and makes
    // working with item selections dodgy
    $(".entry, th").live("mousedown", function(e) { return false; });
    

    // handle task selection and multiselection
    $(".entry").live("click", function(event) {
        // if ctrl is down TOGGLE selection, else select item
        self.selectEntry(this, event.ctrlKey 
            ? !$(this).hasClass("selected") 
            : true
        );

        // if shift is down, select between the new click
        // recipient and the 'current' (last selected) item.
        if (event.shiftKey && self.options.multiselect) {
            // deselect everything
            $(".selected").not($(this)).not(self.__current).removeClass("selected");
            // if there's a current element and it's not the
            // one we've just clicked on, select everything in between
            if (self.__current && self.__current != this) {
                var traverser = parseInt($(self.__current).data("row")) >
                    parseInt($(this).data("row")) 
                    ? "prevUntil"
                    : "nextUntil";
                $(self.__current)[traverser]("#" + this.id).each(function(i, elem) {
                    self.selectEntry(elem, true);                        
                });
            }
        // if ctrl is down, don't clear the last selection 
        } else if (!self.options.multiselect || !event.ctrlKey) {
            var id = this.id;
            $(".selected").each(function(i, entry) {
                if (entry.id != id) {
                    self.selectEntry(entry, false);
                }
            });                                          
        }
        // store the selector of the current element
        // to use when selecting a range
        if (self.__current == null || !event.shiftKey)
            self.__current = this;

        // finally, trigger any user callbacks
        self.rowClicked(event, parseInt($(this).data("row")));
    });

    $(".entry").live("dblclick", function(event) {
        self.rowDoubleClicked(event, parseInt($(this).data("row")));
    });

    $(".entry > td").live("click", function(event) {
        self.cellClicked(event, parseInt($(this).parent().data("row")),
                parseInt($(this).data("col")));
    });

}


AbstractListWidget.prototype.onClose = function(event) {

}

AbstractListWidget.prototype.resized = function(event) {
    this.syncHeadWidths();
}

AbstractListWidget.prototype.setHeight = function(height) {
    var diff = height - $("#tscroll").height();
    $("#tscroll").height(height - 30);
}

AbstractListWidget.prototype.setWaiting = function(wait) {
    m_container.toggleClass("waiting", wait);
}

// set a task in the list selected and store it's id
// so the selection can be preserved after refresh
AbstractListWidget.prototype.selectEntry = function(entry, select) {
    $(entry).toggleClass("selected", select);
    var key = $(entry).data("key");
    if (key) {
        if (select) {
            this.__selected[key] = true;
        } else {
            this.__selected[key] = undefined;
        }
    }
}


// update the data in the table when the file
// data changes
AbstractListWidget.prototype.refreshEntries = function() {
    this.setTableLength();
    
    var entries = $(".entry");
    var data = this.data;
    //var entry, cells, cell;
    var key, entry, cells, cell;
    for (var row = 0; row < data.dataLength(); row++) {
        key = data.rowKey(row);
        entry = $(entries.get(row));
        cells = entry.find("td");
        entry
            .attr("class", "entry")
            .data("row", row)
            .data("key", key)
            .attr("id", "entry" + row)
            .addClass(row % 2 ? "odd" : "");
        $.each(data.rowMetadata(row), function(k, v) {
            entry.data(k, v);
        });
        $.each(data.rowClassNames(row), function(i, v) {
            entry.addClass(v);
        });
        for (var col = 0; col < data.columnCount(); col++) {
            cell = $(cells.get(col));
            cell.data("col", col).text(data.cellLabel(row, col));
            $.each(data.cellMetadata(row, col), function(k, v) {
                cell.data(k, v);
            });
            $.each(data.cellClassNames(row, col), function(i, v) {
                cell.addClass(v);
            }); 
        }
        // if the data source defines a usable key, re-select
        // those elements that might've been selected before
        if (key && this.__selected[key]) {
            entry.addClass("selected");
        }
    };

    $(".entry").show();
    this.syncHeadWidths();
}

AbstractListWidget.prototype.clearSelection = function() {
    this.__selected = {};
    $("#entrytable").find("entry").removeClass("selected");
}

// sync the header table's columns with the file list's widths
AbstractListWidget.prototype.syncHeadWidths = function() {
    for (var i in [0, 1, 2]) {
        var head = $($("#headtable").find("th").get(i));
        var pad = head.outerWidth() - head.width();
        var w =  $($("#entrytable").find("td").get(i)).outerWidth(true) - pad;
        head.css("width", w);
    }
}


// insert the appropriate number of empty rows
// into the filetable
AbstractListWidget.prototype.setTableLength = function() {
    var row = $("<tr></tr>")
        .addClass("entry")
        .css("MozUserSelect", "none");
    for (var col = 0; col < this.data.columnCount(); col++) {
        row.append($("<td></td>"));
    }
    var entrytable = $("#entrytable");
    var entries = entrytable.find(".entry");
    var diff = entries.length - this.data.dataLength();
    if (diff < 0) {
        while (diff++) {
            entrytable.append(row.clone());
        }
    } else if (diff > 0) {
        for (var i = this.data.dataLength(); i < entries.length; i++) {
            entries.slice(i).remove();
        }
    }
}


AbstractListWidget.prototype.buildUi = function(data) {
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
        .append(this.buildHeaderTable())
        .append(tablescroll)
        .append(this.buildPaginators());

    return innercontainer;
}


AbstractListWidget.prototype.buildHeaderTable = function() {
    var headtable = $("<table></table>")
        .addClass("listhead")
        .attr("id", "headtable");
    var thead = $("<thead></thead>");
    var headrow = $("<tr></tr>");
    headtable.append(thead.append(headrow));
    
    var self = this;
    for (var col = 0; col < self.data.columnCount(); col++) {
        var th = $("<th></th>")
            .data("sort", col)
            .data("index", col);
        th.text(self.data.headerLabel(col));
        // add a dragger to all but the last column
        if (col < self.data.columnCount() - 1) {
            th.append(
                $("<div></div>").addClass("header_drag")
                    .append($("<div></div>").addClass("header_line"))
            );
        }
        var sortdiv = $("<div></div>").addClass("sort_arrow");
        if (col == self.data.sortColumn()) {
            sortdiv.addClass(self.data.descending() ? "order_desc" : "order");
        }
        th.append(sortdiv);
        headrow.append(th);
    }
    return headtable;
}

AbstractListWidget.prototype.buildPaginators = function() {
    var data = this.data;
    if (!data.isPaginated()) {
        return $();
    }
    var container = $("<div></div>").addClass("paginators"); 
    var pag = $("<div></div>")
        .addClass("pagination")
        .addClass("step_links");
    if (data.hasPrev()) {
        pag.append($("<a>Previous</a>")
                .attr("href", url + "?page="
                    + data.prevPage()));
    }
    pag.append($("<span></span>")
            .text("Page " + data.page() + " of " + data.numPages()).html());
    if (data.has_next) {
        pag.append($("<a>Next</a>")
                .attr("href", url + "?page="
                    + data.nextPage()));
    }
    return container.append(pag);
}


// translate size in bytes into a human-readable one
AbstractListWidget.prototype.reportSize = function(size) {
    if (size < 1024)
        return size + " bytes";
    else if (size < 1024 * 1024)
        return (Math.round(size / 102.4) / 10) + " KB";
    else
        return (Math.round(size / 104857.6) / 10) + " MB";
}    


AbstractListWidget.prototype.cellClicked = function(event, row, col) {
}

AbstractListWidget.prototype.rowClicked = function(event, row) {
}

AbstractListWidget.prototype.rowDoubleClicked = function(event, row) {
}


