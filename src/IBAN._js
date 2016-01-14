"use strict";

exports.parser = function(_type) {
  var formats = {
    "DE":{"format":"kkBBBBBBBBCCCCCCCCCC","B":"bank","C":"account","G":"desk","K":"key"},
    "AD":{"format":"kkBBBBSSSSCCCCCCCCCCCC","B":"bank","C":"account","G":"desk","K":"key"},
    "SA":{"format":"kkBBCCCCCCCCCCCCCCCC","B":"bank","C":"account","G":"desk","K":"key"},
    "AT":{"format":"kkBBBBBCCCCCCCCCCC","B":"bank","C":"account","G":"desk","K":"key"},
    "BE":{"format":"kkBBBCCCCCCCKK","B":"bank","C":"account","G":"desk","K":"key"},
    "BA":{"format":"kkBBBSSSCCCCCCCCKK","B":"bank","C":"account","G":"desk","K":"key"},
    "BR":{"format":"kkBBBBBBBBSSSSSCCCCCCCCCCIP2","B":"bank","C":"account","G":"desk","K":"key"},
    "BG":{"format":"kkBBBBSSSSDDCCCCCCCC","B":"bank","C":"account","G":"desk","K":"key"},
    "HR":{"format":"kkBBBBBBBCCCCCCCCCC","B":"bank","C":"account","G":"desk","K":"key"},
    "CY":{"format":"kkBBBSSSSSCCCCCCCCCCCCCCCC","B":"bank","C":"account","G":"desk","K":"key"},
    "DK":{"format":"kkBBBBCCCCCCCCCC","B":"bank","C":"account","G":"desk","K":"key"},
    "ES":{"format":"kkBBBBGGGGKKCCCCCCCCCC","B":"bank","C":"account","G":"desk","K":"key"},
    "EE":{"format":"kkBBBBCCCCCCCCCCCK","B":"bank","C":"account","G":"desk","K":"key"},
    "FO":{"format":"kkCCCCCCCCCCCCCC","B":"bank","C":"account","G":"desk","K":"key"},
    "FI":{"format":"kkBBBBBBCCCCCCCK","B":"bank","C":"account","G":"desk","K":"key"},
    "FR":{"format":"kkBBBBBGGGGGCCCCCCCCCCCKK","B":"bank","C":"account","G":"desk","K":"key"},
    "GI":{"format":"kkBBBBCCCCCCCCCCCCCCC","B":"bank","C":"account","G":"desk","K":"key"},
    "GB":{"format":"kkBBBBSSSSSSCCCCCCCC","B":"bank","C":"account","G":"desk","K":"key"},
    "GR":{"format":"kkBBBBBBBCCCCCCCCCCCCCCCC","B":"bank","C":"account","G":"desk","K":"key"},
    "GL":{"format":"kkCCCCCCCCCCCCCC","B":"bank","C":"account","G":"desk","K":"key"},
    "HU":{"format":"kkBBBGGGGKCCCCCCCCCCCCCCCK","B":"bank","C":"account","G":"desk","K":"key"},
    "IS":{"format":"kkBBBBSSCCCCCCXXXXXXXXXX","B":"bank","C":"account","G":"desk","K":"key"},
    "IE":{"format":"kkAAAABBBBBBCCCCCCCC","B":"bank","C":"account","G":"desk","K":"key"},
    "IT":{"format":"kkABBBBBCCCCCXXXXXXXXXXXX","B":"bank","C":"account","G":"desk","K":"key"},
    "LV":{"format":"kkBBBBCCCCCCCCCCCCC","B":"bank","C":"account","G":"desk","K":"key"},
    "LI":{"format":"kkBBBBBCCCCCCCCCCCC","B":"bank","C":"account","G":"desk","K":"key"},
    "LT":{"format":"kkBBBBBCCCCCCCCCCC","B":"bank","C":"account","G":"desk","K":"key"},
    "LU":{"format":"kkBBBCCCCCCCCCCCCC","B":"bank","C":"account","G":"desk","K":"key"},
    "MK":{"format":"kkBBBCCCCCCCCCCKK","B":"bank","C":"account","G":"desk","K":"key"},
    "MT":{"format":"kkBBBBSSSSSCCCCCCCCCCCCCCCCCC","B":"bank","C":"account","G":"desk","K":"key"},
    "MC":{"format":"kkBBBBBGGGGGCCCCCCCCCCCKK","B":"bank","C":"account","G":"desk","K":"key"},
    "NL":{"format":"kkBBBBCCCCCCCCCC","B":"bank","C":"account","G":"desk","K":"key"},
    "NO":{"format":"kkBBBBCCCCCCC","B":"bank","C":"account","G":"desk","K":"key"},
    "PL":{"format":"kkBBBBBBBkCCCCCCCCCCCCCCCC","B":"bank","C":"account","G":"desk","K":"key"},
    "PT":{"format":"kkBBBBBBBBCCCCCCCCCCCKK","B":"bank","C":"account","G":"desk","K":"key"},
    "CZ":{"format":"kkBBBBSSSSSSCCCCCCCCCC","B":"bank","C":"account","G":"desk","K":"key"},
    "RO":{"format":"kkBBBBCCCCCCCCCCCCCCCC","B":"bank","C":"account","G":"desk","K":"key"},
    "SM":{"format":"kkABBBBBCCCCCXXXXXXXXXXXX","B":"bank","C":"account","G":"desk","K":"key"},
    "RS":{"format":"kkBBBCCCCCCCCCCCCCCC","B":"bank","C":"account","G":"desk","K":"key"},
    "CS":{"format":"kkBBBCCCCCCCCCCCCCCC","B":"bank","C":"account","G":"desk","K":"key"},
    "SK":{"format":"kkBBBBCCCCCCCCCCCCCCCC","B":"bank","C":"account","G":"desk","K":"key"},
    "SI":{"format":"kkBBBBBCCCCCCCCKK","B":"bank","C":"account","G":"desk","K":"key"},
    "SE":{"format":"kkBBBBCCCCCCCCCCCCCCCC","B":"bank","C":"account","G":"desk","K":"key"},
    "CH":{"format":"kkBBBBBCCCCCCCCCCCC","B":"bank","C":"account","G":"desk","K":"key"},
    "TR":{"format":"kkBBBBBRCCCCCCCCCCCCCCCC","B":"bank","C":"account","G":"desk","K":"key"},
    "TN":{"format":"kkBBBBBCCCCCCCCCCCCCCC","B":"bank","C":"account","G":"desk","K":"key"}
  };

  return function(_ , _item) {
    var country = _item.buffer.substring(0,2);
    _item.data = {};
    _item.data["IBAN"] = _item.buffer;
    if(formats[country]) {
      var buffer = _item.buffer.substring(2);
      formats[country].format.split("").forEach(function(ch) {
        var part = formats[country][ch] || ch;
        _item.data[part] = _item.data[part] || "";
        _item.data[part] += buffer.substring(0,1);
        buffer = buffer.substring(1);
      });
    }
    return _item;
  }
}
