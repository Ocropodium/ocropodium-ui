

var OCRJS = OCRJS || {};

OCRJS.Nodetree.StateManager = OCRJS.OcrBase.extend({
    constructor: function(parent, tree) {
        this.parent = parent;
        this.tree = tree;

        this._open = null;
        this._name = null;
        this._hash = null;

        this._listeners = {
            opened: [],
            cleared: [],
        };
    },

    NEW_CLEAN: 0x01,
    OPEN_CLEAN: 0x02,
    NEW_DIRTY: 0x04,
    OPEN_DIRTY: 0x08,

    getState: function() {
        if (this.isDirty())
            return this.getOpen() ? this.OPEN_DIRTY : this.NEW_DIRTY;
        return this.getOpen() ? this.OPEN_CLEAN : this.NEW_CLEAN;
    },        

    getOpen: function() {
        return this._open;
    },

    getName: function() {
        return this._name;
    },                 

    setOpen: function(slug, name) {
        this._open = slug;
        this._name = name;
        this._hash = this.getTreeHash();        
        this.callListeners("opened", this.getCurrentName());
    },

    clear: function() {
        this.tree.clearScript();
        this._hash = this._name = this._open = null;
        this.callListeners("cleared");
    },

    isDirty: function() {
        if (!this._open && !this.tree.hasNodes())
            return false;
        return this._hash != this.getTreeHash();
    },

    getCurrentSlug: function() {
        return this.getOpen() || "untitled";
    },

    getCurrentName: function() {
        return this.getName() || "Untitled";
    },                        

    getTreeHash: function() {
        return hex_md5(bencode(this.tree.buildScript())); 
    },

    getTreeJSON: function() {
        return JSON.stringify(this.getTreeScript(), null, 2)
    },

    getTreeScript: function() {
        return this.tree.buildScript();
    },

    setScript: function(data) {
        this.tree.clearScript();
        this.tree.loadScript(data);
        this.tree.scriptChanged("Loaded script");
        this._hash = this.getTreeHash();        
    },              

    save: function() {
        var presetdata = {
            open: this._open,
            name: this._name,
            hash: this._hash,
            script: this.tree.buildScript(),
            treehash: this.getTreeHash(),
        };
        console.log("Saving preset data", presetdata);
        $.cookie("presetdata", JSON.stringify(presetdata));
    },

    getCookieData: function() {
        var jsondata = $.cookie("presetdata");
        if (!jsondata) {
            console.log("No state cookie found");
            return;
        }
        var data = JSON.parse(jsondata);
        var expect = ["open", "hash", "script", "treehash"];
        for (var i in expect) {
            if (!expect[i] in data)
                throw "Error loading data.  Field: " + expect[i] + " not in unflattened cookie data";            
        }
        console.log("Loading data", data);
        return data;
    },                       

    load: function() {
        var data = this.getCookieData();              
        this.tree.loadScript(data.script);
        this._open = data.open;
        this._name = data.name;
        this._hash = data.hash;
        if (data.treehash != this.getTreeHash())
            throw "Error loading data.  Loaded tree hash does not match stored.";        
        this.callListeners("opened", this.getCurrentName());
    }    
});
