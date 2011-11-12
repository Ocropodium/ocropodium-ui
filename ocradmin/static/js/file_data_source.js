// Data source for file browser widget


var FileDataSource = AbstractDataSource.extend({
    init: function() {
        this._super();
        this._data = [];
        this._lsurl = "/filebrowser/ls";
        this._dir = "";
        this._headers = [{
                name: "Name",
                sortAs: "str",
            }, {
                name: "Size",
                sortAs: "num",
            }, {
                name: "Modified",
                sortAs: "num",
            },
        ]
    },


    renderCellAt1: function(row) {
        var size = this._data[row][this.c2d(1)];
        if (size < 1024) {
            return size + " bytes";
        } else if (size < 1024 * 1024) {
            return (Math.round(size / 102.4) / 10) + " KB";
        } else {
            return (Math.round(size / 104857.6) / 10) + " MB";
        }
    },

    renderCellAt2: function(row) {
        var date = new Date();
        date.setTime(parseFloat(this._data[row][this.c2d(2)]) * 1000);
        return date.toString();
    },

    rowKey: function(row) {
        return this._data[row][0];
    },

    rowMetadata: function(row) {
        var value = this._dir == ""
            ? this._data[row][0]
            : this._dir + "/" + this._data[row][0];
        return {
            name: this._data[row][0],
            type: this._data[row][1],
            value: value,
        };
    },

    rowClassNames: function(row) {
        return [
            this._data[row][1],
        ];
    },

    cellClassNames: function(row, col) {
        if (col == 0)
            return ["n"];
        return [];
    },

    preSort: function(a, b) {
        if (a[1] == "dir" && b[1] != "dir")
            return -1;
        if (b[1] == "dir" && a[1] != "dir")
            return 1;
        return 0;
    },

    setCwd: function(dir) {
        if (this._dir != "")
           this._dir = this._dir + "/" + dir;
        else
           this._dir = dir;
        this.refreshData();
    },

    backDir: function() {
        if (this._dir.match(/(.*)\/[^\/]+$/))
            this._dir = RegExp.$1;
        else
            this._dir = "";
        this.refreshData();
    },

    c2d: function(col) {
        if (col == 0)
            return col;
        if (col == 1)
            return 2;
        if (col == 2)
            return 4;
    },

    refreshData: function(params) {
        var self = this;
        $.ajax({
            url: self._lsurl,
            dataType: "json",
            data: "dir=" + self._dir,
            beforeSend: function(e) {
                self.trigger("startRefresh");
            },
            complete: function(e) {
                self.trigger("endRefresh");
            },
            success: function(data) {
                if (data.error) {
                    alert(data.error);
                    return;
                }
                if (data.length && data[0].error) {
                    alert("Error: " + data[0].error);
                    return;
                }
                self._data = data;
                self.sort();
            },
            error: OcrJs.ajaxErrorHandler,
        });
    },
});


