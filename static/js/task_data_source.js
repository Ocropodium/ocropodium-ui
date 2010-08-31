// Data source for file browser widget


function TaskDataSource() {
    this.__data = [];
    this.__url = "/ocrtasks/list";
    this.__dir = "";
    this.__headers = [{
            name: "Page File",
            sortAs: "str",
        }, {
            name: "User",
            sortAs: "str",
        }, {
            name: "Last Updated",
            sortAs: "str",
        }, {
            name: "Status",
            sortAs: "str",
        }, 
    ];

    this.__sortby = "name";
    this.__col2sort = {
        0: "name",
        1: "user",
        2: "updated_on",
        3: "status",
    };
}

TaskDataSource.prototype = new AbstractDataSource();
TaskDataSource.constructor = TaskDataSource();

TaskDataSource.prototype.isPaginated = function() {
    return this.__data.has_other_pages;
}

TaskDataSource.prototype.page = function() {
    return this.__page;
}

TaskDataSource.prototype.setPage  = function(page) {
    this.__page = page;
    this.refreshData();
}

TaskDataSource.prototype.nextPage = function() {
    return this.__data.next_page_number;
}

TaskDataSource.prototype.prevPage = function() {
    return this.__data.prev_page_number;
}

TaskDataSource.prototype.hasPrev = function() {
    return this.__data.has_previous;
}

TaskDataSource.prototype.hasNext = function() {
    return this.__data.has_next;
}

TaskDataSource.prototype.numPages = function() {
    return this.__data.num_pages;
}

TaskDataSource.prototype.rowMetadata = function(row) {
    return {
    };
}

TaskDataSource.prototype.rowClassNames = function(row) {
    return [
    ];
}

TaskDataSource.prototype.cellClassNames = function(row, col) {
    return [];
}

TaskDataSource.prototype.sortByColumn = function(col) {
    var s = this.__col2sort[col];
    if (this.__sortby == s)
        this.__desc = !this.__desc;
    else
        this.__sortby = s;
    this.refreshData();
}

TaskDataSource.prototype.preSort = function(a, b) {
    return 0;
}

TaskDataSource.prototype.c2d = function(col) {
    return col;
}

TaskDataSource.prototype.refreshData = function(params) {
    var self = this;
    $.ajax({
        url: self.__url,
        dataType: "json",
        data: {
            page: self.__page,
            order_by: self.__desc ? "-" + self.__sortby : self.__sortby,
        },
        beforeSend: function(e) {
            self.callListeners("startRefresh");
        },
        complete: function(e) {
            self.callListeners("endRefresh");
        },
        success: function(data) {
            if (data.length && data[0].error) {
                alert("Error: " + data[0].error);
                return;
            }
            self.__data = data;
        },
        error: function(xhr, error) {
            alert(error);
        },
    });
}


