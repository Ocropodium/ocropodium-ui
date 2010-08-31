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

    this.__page = 1;
    this.__sortby = "updated_on";
    this.__desc = true;
    this.__sortcol = 2;
    this.__col2sort = {
        0: "page_name",
        1: "user__username",
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
    return this.__data.previous_page_number;
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

TaskDataSource.prototype.url = function() {
    return this.__url;
}

TaskDataSource.prototype.dataLength = function() {
    return this.__data.object_list.length;
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

TaskDataSource.prototype.cellLabel = function(row, col) {
    if (col == 0)
        return this.__data.object_list[row].fields.page_name;
    if (col == 1)
        return this.__data.object_list[row].fields.user.fields.username;
    if (col == 2)
        return this.__data.object_list[row].fields.updated_on;
    if (col == 3)
        return this.__data.object_list[row].fields.status;
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
            if (data.error) {
                alert("Error: " + data.error);
                return;
            }
            self.__data = data;
            self.callListeners("dataChanged");
        },
        error: function(xhr, error) {
            alert(error);
        },
    });
}


