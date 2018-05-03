var rollback_data = {
	'original': [ 'a', 'b', 'c', 'd', 'e', 'f' ],
	"mutated": []
};

// deliver a clone
module.exports = function() {
	return JSON.parse(JSON.stringify(rollback_data));
};