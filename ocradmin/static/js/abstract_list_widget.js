// class for browsing and selecting files on the server

var AbstractListWidget = OcrJs.Base.extend({
    init: function(parent, datasource, options) {
        this._super();
        this.parent = parent;
        this.data = datasource;
        this.options = {
            multiselect: true,
        };
        $.extend(this.options, options);

        // currently selected list entry
        // (the last one clicked)
        this._current = null;
        this._selected = {};

        var self = this;
        this.data.addListener("dataChanged", function() {
            self.refreshEntries();
        });
        $(this.parent).html("");
        $(this.parent).append(this.buildUi());
        this.setupEvents();
        this.setupMouseEvents();
        this.data.refreshData();
    },

    dataSource: function() {
        return this.data;
    },

    container: function() {
        return $(this.parent);
    },

    setupEvents: function() {

    },

    setupMouseEvents: function() {

        var self = this;

        // sync the headers when container size changes
        $(self.parent).resize(function() {
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
        $("th", self.parent).bind("click.headsort", headSort);

        // we don't want to sort the headers
        $(".header_drag", self.parent).bind("mouseover.sizenter mouseout.sizeleave", function(event) {
            if (event.type == "mouseover") {
                $("th", self.parent).unbind("click.headsort");
            } else {
                $("th", self.parent).bind("click.headsort", headSort);
            }
        });


        // when the user clicks on a header separator, bind the mouse move
        // event to resize the columns of both header and entry tables.
        $(".header_drag", self.parent).bind("mousedown.headsize", function(event) {
            var head = $(this).parent();
            var cell = $($(".entrylist", self.parent).find("td").get(head.data("index")));
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
        $("th", self.parent).live("mousedown.headclick", function(event) {
            var cell = $(this);
            cell.addClass("pressed");
            $(document).bind("mouseup.press", function(mue) {
                cell.removeClass("pressed");
                $(document).unbind("mouseup.press");
            });
        });


        // don't allow selecting the list - it looks bad and makes
        // working with item selections dodgy
        $(".entry, th", self.parent).live("mousedown.noselect", function(e) { return false; });
        

        // handle task selection and multiselection
        $(".entry", self.parent).live("click.entryselect", function(event) {
            // if ctrl is down TOGGLE selection, else select item
            self.selectEntry(this, event.ctrlKey
                ? !$(this).hasClass("ui-selected")
                : true
            );

            // if shift is down, select between the new click
            // recipient and the 'current' (last selected) item.
            if (event.shiftKey && self.options.multiselect) {
                // deselect everything
                $(".ui-selected", self.parent).not($(this)).not(self._current).removeClass("ui-selected");
                // if there's a current element and it's not the
                // one we've just clicked on, select everything in between
                if (self._current && self._current != this) {
                    var traverser = parseInt($(self._current).data("row")) >
                        parseInt($(this).data("row"))
                        ? "prevUntil"
                        : "nextUntil";
                    $(self._current)[traverser]("#" + this.id).each(function(i, elem) {
                        self.selectEntry(elem, true);
                    });
                }
            // if ctrl is down, don't clear the last selection
            } else if (!self.options.multiselect || !event.ctrlKey) {
                var id = this.id;
                $(".ui-selected", self.parent).each(function(i, entry) {
                    if (entry.id != id) {
                        self.selectEntry(entry, false);
                    }
                });
            }
            // store the selector of the current element
            // to use when selecting a range
            if (self._current == null || !event.shiftKey)
                self._current = this;

            // finally, trigger any user callbacks
            self.rowClicked(event, parseInt($(this).data("row")));
        });

        $(".entry", self.parent).live("dblclick.rowdckick", function(event) {
            self.rowDoubleClicked(event, parseInt($(this).data("row")));
        });

        $(".entry > td", self.parent).live("click.rowclick", function(event) {
            self.cellClicked(event, parseInt($(this).parent().data("row")),
                    parseInt($(this).data("col")));
        });
        
        $(".page_link", self.parent).live("click.linkclick", function(event) {
            self.data.setPage(parseInt($(this).data("page")));
            event.preventDefault();
        });
    },

    teardownEvents: function() {
        $(".entry", this.parent).die("dblclick.rowdckick");
        $(".entry > td", this.parent).die("click.rowclick");
        $(".page_link", this.parent).die("click.linkclick");
        $(".entry, th", this.parent).die("mousedown.noselect");
        $(".entry", this.parent).die("click.entryselect");
        $("th", this.parent).die("mousedown.headclick");
        $(".header_drag", this.parent).unbind("mousedown.headsize");
        $(".header_drag", this.parent).unbind("mouseover mouseout");
        $("th", this.parent).unbind("click.headsort");
        $(".header_drag", this.parent).unbind("mouseover.sizenter mouseout.sizeleave");
    },

    onClose: function(event) {

    },

    resized: function(event) {
        this.syncHeadWidths();
    },

    setHeight: function(height) {
        var diff = height - $("#lwscroll").height();
        $("#lwscroll").height(height - 60);
    },

    setWaiting: function(wait) {
        m_container.toggleClass("waiting", wait);
    },

    // set a task in the list selected and store it's id
    // so the selection can be preserved after refresh
    selectEntry: function(entry, select) {
        $(entry).toggleClass("ui-selected", select);
        var key = $(entry).data("key");
        if (key) {
            if (select) {
                this._selected[key] = true;
            } else {
                this._selected[key] = undefined;
            }
        }
    },


    // update the data in the table when the file
    // data changes
    refreshEntries: function() {
        this.setTableLength();
        
        var entries = $(".entry", this.parent);
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
            if (key && this._selected[key]) {
                entry.addClass("ui-selected");
            }
        };

        $(".entry").show();
        this.syncHeadWidths();
    },

    clearSelection: function() {
        this._selected = {};
        $(".entrylist", this.parent).find(".entry.ui-selected").removeClass("ui-selected");
    },

    // sync the header table's columns with the file list's widths
    syncHeadWidths: function() {
        for (var i in [0, 1, 2]) {
            var head = $($("#headtable", this.parent).find("th").get(i));
            var pad = head.outerWidth() - head.width();
            var w =  $($(".entrylist", this.parent).find("td").get(i)).outerWidth(true) - pad;
            head.css("width", w);
        }
    },


    // insert the appropriate number of empty rows
    // into the filetable
    setTableLength: function() {
        $(".paginators", this.parent).remove();
        if (this.data.isPaginated()) {
            $(this.parent).append(this.buildPaginators());
        }

        var row = $("<tr></tr>")
            .addClass("entry")
            .css("MozUserSelect", "none");
        for (var col = 0; col < this.data.columnCount(); col++) {
            row.append($("<td></td>"));
        }
        var entrytable = $(".entrylist", this.parent).first();
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
    },


    buildUi: function(data) {
        // we need a separate table for the header because
        // we don't want it to scroll when the table does
        var entrytable = $("<table></table>")
            .addClass("entrylist")
            .attr("id", "entrytable");

        var tablescroll = $("<div></div>")
            .attr("id", "lwscroll")
            .append(entrytable);

        var innercontainer = $("<div></div>")
            .addClass("lwcontainer")
            .append(this.buildHeaderTable())
            .append(tablescroll);

        return innercontainer;
    },


    buildHeaderTable: function() {
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
    },

    buildPaginators: function() {
        var data = this.data;
        var container = $("<div></div>").addClass("paginators");
        var pag = $("<div></div>")
            .addClass("pagination")
            .addClass("step_links")
                
        pag.append($("<span></span>")
                .text("Page " + data.page() + " of " + data.numPages()));
        if (data.hasPrev()) {
            pag.prepend(
                $("<a></a>")
                    .attr("href", data.url() + "?page=" + data.prevPage())
                    .addClass("page_link")
                    .data("page", data.prevPage())
                    .text("Previous")
            );
        }
        if (data.hasNext()) {
            pag.append(
                $("<a></a>")
                    .attr("href", data.url() + "?page=" + data.nextPage())
                    .addClass("page_link")
                    .data("page", data.nextPage())
                    .text("Next")
            );
        }
        return container.append(pag);
    },

    cellClicked: function(event, row, col) {
    },

    rowClicked: function(event, row) {
    },

    rowDoubleClicked: function(event, row) {
    },

});

