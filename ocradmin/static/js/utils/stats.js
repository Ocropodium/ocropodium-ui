// Code copied from:
// http://maiaco.com/articles/computingStatsInJS.php

/** Returns an object that contains the count, sum,
 * minimum, median, maximum, mean, variance, and
 * standard deviation of the series of numbers stored
 * in the specified array.  This function changes the
 * specified array by sorting its contents. */
function Stats(data) {
    this.count = data.length;

    /* Sort the data so that all seemingly
     * insignificant values such as 0.000000003 will
     * be at the beginning of the array and their
     * contribution to the mean and variance of the
     * data will not be lost because of the precision
     * of the CPU. */
    data.sort(ascend);

    /* Since the data is now sorted, the minimum value
     * is at the beginning of the array, the median
     * value is in the middle of the array, and the
     * maximum value is at the end of the array. */
    this.min = data[0];
    var middle = Math.floor(data.length / 2);
    if ((data.length % 2) != 0) {
        this.median = data[middle];
    }
    else {
        this.median = (data[middle - 1] + data[middle]) / 2;
    }
    this.max = data[data.length - 1];

    /* Compute the mean and variance using a
     * numerically stable algorithm. */
    var sqsum = 0;
    this.mean = data[0];
    for (var i = 1;  i < data.length;  ++i) {
        var x = data[i];
        var delta = x - this.mean;
        var sweep = i + 1.0;
        this.mean += delta / sweep;
        sqsum += delta * delta * (i / sweep);
    }
    this.sum = this.mean * this.count;
    this.variance = sqsum / this.count;
    this.sdev = Math.sqrt(this.variance);
}

/** Returns a string that shows all the properties and
 * their values for this Stats object. */
Stats.prototype.toString = function() {
    var s = 'Stats';
    for (var attr in this) {
        if (typeof(this[attr]) != 'function') {
            s += '  ' + attr + ' ' + this[attr];
        }
    }
    return s;
}


/** Compares two objects using
 * built-in JavaScript operators. */
function ascend(a, b) {
    if (a < b)
        return -1;
    else if (a > b)
        return 1;
    return 0;
}
