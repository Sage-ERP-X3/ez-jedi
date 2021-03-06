"use strict";
/*
  JEDI V 0.02
*/
var path    = require("path");
var tracer  = null;//console.log;

function stringParser(_type) {
  /*dbg*/tracer && tracer.log("new stringParser "); 
  
  return function(_,item) {  
      item.data =  item.buffer || "";
      return item;
  }   
} 

function mapParser(_type) {
  return function(_,_item) {
    _item.data =  (_type.$map && _type.$map[_item.buffer]) || _item.buffer;
    ///*dbg*/tracer && tracer.log("mapParser("+_item.buffer+")="+_item.data); 
    return _item;
  }   
}

function numberParser(_type) {
  /*dbg*/tracer && tracer.log("new numberParser ");
  var decSep,thSep;
  _type.$format && _type.$format.split("").reverse().forEach(function(token) {
    if("0#".indexOf(token) < 0) {
      if(!decSep) {
       decSep = token;
      } else { 
       thSep = token;
      }
    }
  });
  if (thSep ===null ) {
    if (decSep ==='.' || decSep === null) {
      return function(_,_item) {
        _item.data = parseFloat(_item.buffer);
        return _item;
      }
    } else {
      return function(_,_item) {
        _item.data = parseFloat(_item.buffer.replace(decSep,"."));
        return _item;
      }
    }     
  } else {
    return function(_,_item) {
      _item.data = parseFloat(_item.buffer.replace(thSep ,"").replace(decSep,"."));
      return _item;
    }   
  }
}

function datetimeParser(_type) {
  /*dbg*/tracer && tracer.log("new datetimeParser ");
  var pattern ="";
  var previous;
  var digit;
  var map={};
  var idx=0;
  var tokens = "DMYhms";
  // Compute the pattern :
  (_type.$format+"\0").split("").forEach(function(c){
     if(digit) {
      if(c === previous) {
        // one more
        digit += 1;
      } else {
        // flush :
        map[previous] = ++idx;
        pattern += "(\\d{1,"+digit+"})";
        digit = null;
      }
    }
    if(!digit) {
      if(tokens.indexOf(c) > -1){
        digit = 1;
      } else if (c !== "\0") {
        pattern += (("/".indexOf(c) > -1 )?"\\":"")+c;
      }
    }
    previous = c;
  });  
  var regex = new RegExp(pattern);
  
  return function(_,_item) {
    _item.data = null;    
    tracer && tracer.log("datetimeParser:"+_item.buffer); 
    var match = regex.exec(_item.buffer);
    if(match) {
      var data = {};
      tokens.split("").forEach(function(c) {
        data[c] = (match[map[c]] && parseInt(match[map[c]])) || 0;
      });
       _item.data = new Date((data.Y < 100)?data.Y+2000:data.Y,data.M-1,data.D);
     }      
    return _item;
  }
}

function subItem(_item) {
 var item = {chunk:_item.buffer,buffer:null ,data:null};
 if(typeof _item.chunkLength != 'undefined')  item.chunkLength = _item.chunkLength;
 return item;
}

function setDataProperty(_value,_next) {
  var getProperty = function(_object,_property) {
    if(_object[_property]) return _object[_property];

    var data=null;
    Object.keys(_object).filter(function(property){ return (typeof _object[property] === "object")  }).some(function(property){
      data = getProperty(_object[property],_property);
      return (data !== null);
    });
    return data;
  }
  
  return function(_,_root,_data) {
    var item = {
      buffer:getProperty(_root,_value)|| _value
    }
    item = _next(_,item);
    tracer && tracer.log("compute:"+_value+ ":"+item.data);
    return item.data;
  }
}
function setDataVariant(_variant,_setData) {
  return function(_,_root,_data) {
    _data[_variant] = _setData(_,_root,_data[_variant]);
    return _data;
  }
}

function setDataObject(functions) {
  return function(_,_root,_data) {
    functions.forEach_(_,function(_,fct) {
      _data[fct.property] = fct.setData(_,_root,_data[fct.property]);
    });
    return _data;
  }
}


function variantParser(_variant) {
  /*dbg*/tracer && tracer.log("new variantParser ");
 
  if(_variant.$select){
    var regex = new RegExp(_variant.$select);
    return function(_,_item) {
       _item.data = null;
 
      var chunk;
      var variant="default";
      var match = regex.exec(_item.buffer); 
      match && match.filter(function(m){return (typeof m !== "undefined");}).some(function(m) {
        if(chunk) {
          variant = (_variant.$variants[m])? m : variant;
          return true;
        } else {
          chunk   = m;
        }
        return false;
      });   
   
      /*dbg*/tracer && tracer.log("variant:"+variant);
      //dbg:tracer && tracer.log("variant buffer:"+_item.buffer.substring(0,20)+"...");
      
      if(_variant.$variants[variant]){
        var item = subItem(_item);
        _variant.$variants[variant].$parser =  _variant.$variants[variant].$parser || new typeParser(_variant.$root,_variant.$variants[variant]);
         /*dbg*/tracer && tracer.log("parse variant:"+variant);
        var varItem = _variant.$variants[variant].$parser(_,item);
        _item.data = {};
        _item.data[variant] = varItem.data;
        
        if(varItem.setData) {
          _item.setData = setDataVariant(variant,varItem.setData);
        }
   
        // the variant's chunk can be set at the variant level or at the child level   
        if(!_item.chunkLength) {   
          _item.chunkLength = varItem.chunkLength;
          _item.chunk       = varItem.chunk;
        }
      } 
      return _item;
    }
  } else {

    return function(_,_item) {
      //dbg:tracer && tracer.log("=> variantParser _item.chunkLength:"+_item.chunkLength);
       
      //dbg:tracer && tracer.log("variant buffer:"+_item.buffer.substring(0,20)+"...");
      var varItem;
      _item.data = null;
      for(var variant in _variant.$variants) {
        /*dbg*/tracer && tracer.log("variant:",variant);
        var item = subItem(_item);
        _variant.$variants[variant].$parser =  _variant.$variants[variant].$parser || new typeParser(_variant.$root,_variant.$variants[variant]);
        varItem = _variant.$variants[variant].$parser(_,item);
         //dbg:varItem && tracer && tracer.log("variant.0.chunkLength:"+varItem.chunkLength);
         
        if(varItem && varItem.data !== null) {
          _item.data = {};
          _item.data[variant] = varItem.data;
          if(varItem.setData) {
            _item.setData = setDataVariant(variant);
          }
          // the variant's chunk can be set at the variant level or at the child level   
          if(!_item.chunkLength) {   
            _item.chunkLength = varItem.chunkLength;
            _item.chunk       = varItem.chunk;
          }
           //dbg:tracer && tracer.log("variant.1.chunkLength:"+_item.chunkLength);
          return _item;
        }
      }
       //dbg:tracer && tracer.log("variant.2.chunkLength:"+_item.chunkLength);
      return _item;
    }
  }
}

function objectParser(_object) {
  /*dbg*/tracer && tracer.log("new objectParser ");//+JSON.stringify(_object)); 
  Object.keys(_object.$properties).forEach(function(property) {
     /*dbg*/tracer && tracer.log("objectParser.property:"+property);
    _object.$properties[property].$parser   = new typeParser(_object.$root,_object.$properties[property]);
    _object.$properties[property].$optional = ("$optional" in _object.$properties[property])? _object.$properties[property].$optional : true;
  });  
  
  return function(_, $item) {
    //dbg:tracer && tracer.log("Object.1.chunkLength:"+$item.chunkLength);

    var proItem;
    var data = {};
    var item = subItem($item);
    var objChunkLength=0;
    var functions=[];
    for(var property in _object.$properties) {
      item.remain = item.chunk;
      tracer && tracer.log("object."+property);
      //dbg:tracer && tracer.log("object chunk "+item.chunk.substring(0,20)+"...");
      proItem = _object.$properties[property].$parser(_,item);
      if((proItem === null  || proItem.data===null) && (_object.$properties[property].$optional===false)) {
        //dbg:tracer && tracer.log("optional !!! property:"+property+" proItem:"+proItem);
        //dbg:tracer && tracer.log("optional !!!:"+item.chunk.substring(0,80));
        $item.data = null;
        return $item;
      }
      proItem && tracer && tracer.log("proItem.buffer:"+proItem.buffer+" data:"+proItem.data);
      if(proItem && proItem.data!==null) {
        data[property] = proItem.data;
        /*dbg*/tracer && tracer.log("object."+property+"="+proItem.data);
        item.chunk  = item.remain ? item.remain.substring(proItem.chunkLength) : "";
        objChunkLength += proItem.chunkLength;
        tracer && tracer.log("\titem.chunk:"+item.chunk.substring(0,40).replace("\r","\\r").replace("\n","\\n")+"...");
        tracer && tracer.log("objChunkLength:"+objChunkLength);
        item.data   = null;
        item.buffer = null;
        item.chunkLength = 0;
        if(proItem.setData) {
          functions.push({property:property,setData:proItem.setData})
        }
      }
    }
    if(functions.length) {
      $item.setData = setDataObject(functions);
    }
    $item.chunkLength = $item.chunkLength || objChunkLength;
    //dbg:tracer && tracer.log("Object.2.chunkLength:"+$item.chunkLength);
    $item.data   = data;
    return $item;
  }
}

function delimitedParser(_type,_next) {
  /*dbg*/tracer && tracer.log("new delimitedParser");
  return function(_,_item) {
  //dbg:tracer && tracer.log("delimitedParser:",_item.buffer);
  
  var regex1 = null;
  var regex2 = null;
  if( _type.$delimited["escape"]){
    //dbg:tracer && tracer.log("escape:"+_type.$delimited.escape+" regex:"+_type.$delimited.escape+_type.$delimited.delimiter);
    if(_type.$delimited.escape === "\\") {
      regex1 = new RegExp("\\\\"+_type.$delimited.delimiter,"g");
      regex2 = /\\\\/g;
    } else {
      regex1 = new RegExp(_type.$delimited.escape+_type.$delimited.delimiter,"g");
      regex2 = new RegExp(_type.$delimited.escape+_type.$delimited.escape,"g");
    }
  }
  
  var buffer = _item.buffer;
  _item.buffer = "";
  // first remove the first delimiter :
  var pos   = buffer.indexOf(_type.$delimited.delimiter);
  if(pos > -1) {
    buffer = buffer.substring(pos+_type.$delimited.delimiter.length);
    pos = buffer.lastIndexOf(_type.$delimited.delimiter);
    // restore the _item buffer
    if(pos > -1) {
      buffer = buffer.substring(0,pos);  
      if(regex1 != null){
        buffer = buffer.replace(regex1,_type.$delimited.delimiter);
        buffer = buffer.replace(regex2,_type.$delimited.escape);
      }
      _item.buffer = buffer;
      }
    }
    return _next(_,_item);
  }
}

function getAfters(_after) {
  return (toString.call(_after) === '[object Array]' ) ? _after : new Array(_after);
}

function beforeParser(_type,_next) {
  return function(_,_item) {
    //tracer && tracer.log("before:"+_item.chunk.substring(0,100)+"..."); 
    var pos   = _item.chunk.indexOf(_type.$before);
    if(pos > -1) {
      // reduce the length of the chunk :
      _item.start = pos+_type.$before.length;
      _item.chunk = _item.chunk.substring(_item.start);
      if(_item.buffer) _item.buffer = _item.buffer.substring(_item.start);
      else _item.buffer = _item.chunk;
      // reduce the length of the data part :
      //tracer && tracer.log("before.buffer:"+_item.buffer.substring(0,100)); 
      //tracer && tracer.log("before.chunk:"+_item.chunk.substring(0,100)); 
      return _next(_,_item);
    } 
    return null;
  }
}


function afterParser(_type,_next) {
  var handlers = [];
  function escape(s) {
    return s.split("").map(function(c) {
      if("\\+?$()".indexOf(c) > -1) {
        return "\\"+c;            
      }
      return c;
    }).join("");
  }
  getAfters(_type.$after).forEach(function(after){
    switch(after)  {
      case '\r\n': handlers.push({regex:new RegExp(/([^\r\n]*)?/),after:after,pattern:"crlf"}); break;
      case '\n'  : handlers.push({regex:new RegExp(/([^\n]*)?/)  ,after:after,pattern:"crlf"}); break;
      case null  : handlers.push(null); break;
      default:     
        if (_type.$escape && _type.$escape.length) {
          var pattern = "((?:"+escape(_type.$escape)+escape(after)+"|.)*?)" + escape(after);
        } else {
          var pattern = "(.*?)" + escape(after);
        }  
        tracer && tracer.log("after pattern:"+pattern);
        handlers.push({regex:new RegExp(pattern),after:after,pattern:pattern});   
        break;
    }
  });
  
  return function(_,_item) {
    var ok;
    handlers.some(function(handler) {
      if(!handler) {
        _item.chunkLength  = _item.chunk.length;
        _item.buffer       = _item.chunk;
        return (ok = true);            
      } else {
        var match = handler.regex.exec(_item.chunk);
        tracer && tracer.log("after pattern:"+handler.pattern+" chunk="+_item.chunk.substring(0,10));

        if(match) {                                            
           tracer && tracer.log("after match:"+match);
          if( match[1] !== undefined && _item.chunk.substring(match[1].length,match[1].length+handler.after.length) === handler.after) {
            _item.buffer      = match[1];       
           tracer && tracer.log("after buffer:"+handler.buffer);
            _item.chunkLength = (_item.start || 0) +((_item.buffer)?_item.buffer.length : 0) + handler.after.length;
            _item.chunkLength = ((_item.buffer)?_item.buffer.length : 0) + handler.after.length;
            _item.chunk       = _item.chunk.substring(0,_item.chunkLength); 
            return (ok = true);
          } else if(_item.chunk.substring(0,handler.after.length) === handler.after) {
            _item.buffer      = "";  
            _item.chunk       = handler.after;  
            _item.chunkLength =  handler.after.length;
            return (ok = true);
          } 
          return (ok = false);
        } 
      }
      return (ok = false);
    });
   //tracer && tracer.log("after.buffer:"+_item.buffer.substring(0,100)); 
   //tracer && tracer.log("after.chunk:" +_item.chunk.substring(0,100)); 
   
    return (ok)? _next(_,_item): {data:null};
  }  
}

function fixedRecordParser(_type,_next) {
  var afters  = (_type.$after)?getAfters(_type.$after):[]; 
  
  return function(_,_item) {
    if(_type.$length <= _item.chunk.length) {
      _item.chunkLength = _type.$length;
      afters.some(function(after) {
        if(!after) {
          return true;
        } else {
          var t = _item.chunk.substring(_type.$length,_type.$length+after.length);
          if(t === after) {
            _item.chunkLength += after.length;
            return true;
          }
        }
        return false
      });
      // reduce the length of the chunk :
      _item.chunk  = _item.chunk.substring(0,_item.chunkLength);
      _item.buffer = _item.chunk.substring(0,_type.$length);
    } else {
      // no chance to get more data :
      return {data:null};
    }   
    //dbg:tracer && tracer.log("fixed buffer:"+_item.buffer);  
    return _next(_,_item);
  }
}
function setBuffer(_type,_next) {
  return function(_,_item) {
    _item.buffer = _item.chunk;
    tracer && tracer.log("setBuffer buffer:"+_item.buffer.substring(0,20)+"..."); 
    return (_item.buffer)? _next(_,_item): {data:null};
  }
}



function setValue(_type,_next) {
  var match = (new RegExp(/\{\$(\w*)\}/)).exec(_type.$value); 
  if(match){
    return function(_,_item) {
      return {data:_type.$value,setData:setDataProperty(match[1],_next)};
    }
  } else {
    return function(_,_item) {
       _item.chunk  = _type.$value;
       _item.buffer = _item.chunk;
      return _next(_,_item);
    }
  }
}

function getDataParser(_type) {
  if(_type.$type) {
    /*dbg*/tracer && tracer.log("new data parser:"+_type.$type); 
    switch (_type.$type) {
     case "application/x-variant": return new variantParser(_type);
     case "application/json"     : return new objectParser(_type);
     case "application/x-string" : return new stringParser(_type);
     case "application/x-number" : return new numberParser(_type);
     case "application/x-date"   : return (_type.$format ) ? new datetimeParser(_type): new stringParser(_type)
     case "application/x-map"    : return new mapParser(_type);
     default     :
      var transform = require(_type.$type);
      return new transform.parser(_type);      
      //return new stringParser(_type);
    }
  }
  return new stringParser(_type);
}

function controlParser(_type,_next) {
  /*dbg*/tracer && tracer.log("new controlParser:"+_type.$control);
  var regex = new RegExp(_type.$control);
  return function(_,_item) {   
    var match = regex.exec(_item.buffer);  
    //dbg:tracer && tracer.log(_item.buffer+ ((match)?" ":" doesn't" + " match ") + _type.$control);
    return (match != null) ? _next(_,_item): null;
  }
}

function regexParser(_type,_next) {
  /*dbg*/tracer && tracer.log("new regexParser");
  var regex = new RegExp(_type.$regex);
  return function(_,_item) {   
    /*dbg*/tracer && tracer.log("regexParse:"+_item.chunk);
    var match = regex.exec(_item.chunk); 
    if(match) {
      match.filter(function(m){return (typeof m !== "undefined");}).forEach(function(m) {
        tracer && tracer.log("match m:"+m);
        if(!_item.chunkLength) {
          var pos           = _item.chunk.indexOf(m,0);
          _item.chunkLength = pos + m.length; 
          _item.chunk       = _item.chunk.substring(0,_item.chunkLength);
          _item.buffer      = _item.chunk;
        } else {
          _item.buffer      = m;
        }
      });
    } 
    return (match != null) ? _next(_,_item): null;
  }
}
function getRegexParser(_type,_next) {
  _type.$regex = "";
  var count={"0":0,"#":0};
  (_type.$format+'\0').split("").forEach(function(c){
    if(c in count) {
      count[c] += 1;  
    } else {
      if(count["0"] || count["#"]) {
        _type.$regex += "[0-9]{"+count["0"]+","+(count["#"]+count["0"])+"}";
        count={"0":0,"#":0};
      }
      if(c !== '\0') {
        if("\\.".indexOf(c) > -1) {
          _type.$regex += "\\" 
        }
        _type.$regex += c;
      } 
    }
  });
  /*dbg*/tracer && tracer.log("new getRegexParser "+ _type.$regex);
  return regexParser(_type,_next);
}


function typeParser(_root,_type) {
  var type;
  if (typeof _type === "undefined") { 
    type = _root;
  } else {
    type = _type;
  }
  type.$root = _root;

  //dbg:tracer && tracer.log("model:"+type.$model); 
  if(type.$model && type.$root && type.$root.$variants && type.$root.$variants[type.$model]) {
   /*dbg*/tracer && tracer.log("load model:"+type.$model); 
    return  typeParser(type.$root,type.$root.$variants[type.$model]);
  } else {
    var next = getDataParser(type);
    if(type.$control) {
      next = new controlParser(type,next);
    }  
    if(type.$delimited && type.$delimited.delimiter) {
      next = new delimitedParser(type,next);
    }
    if(type.$length) {
      // It's a fixed record 
      next =  new fixedRecordParser(type,next);
    } else if(type.$after  || type.$before) {
      // It's a variable record 
      if(type.$before) {
        next =  new beforeParser(type,next);
      }
      if(type.$after) {
        next =  new afterParser(type,next);
      }
    } else if(type.$value) {
      next =  new setValue(type,next);
    } else if(type.$format) {
      next =  new getRegexParser(type,next);
    } else if(type.$regex) {
      next =  new regexParser(type,next);
    } else {
      next = new setBuffer(type,next);
    }
      
    return function(_,_item) {
      var item = {chunk:_item.chunk,chunkLength:_item.chunkLength,buffer:_item.chunk,data:null,invalidFormat:false};
      return next(_,item);
    }
  }
}


function parseStructure(_,_structure,_reader,_item) {
  /*dbg*/tracer && tracer.log("parse structure"); 
  var chunk;
  if(!_item) {
    _item = {chunk:null,buffer:null,remain:null,data:null};
    _item.remain = _reader.read(_);
  } else {
    if (!_item.remain || !_item.remain.length) {
      chunk = _reader.read(_);
      if (chunk === undefined) return null;
      _item.remain += chunk; 
    }
  }
  _item.data = {};
  
  var item;
  _structure.$parser = _structure.$parser || new typeParser(_structure);
        
  _item.chunk = _item.remain;
  // chunkLength is set by parsers !
  _item.chunkLength  = 0;
  while((item = _structure.$parser(_,_item)) != null) { 
    if(!item.data) {
      //dbg:tracer && tracer.log("!item.data =>_reader.read"); 
      chunk =  _reader.read(_);
      if(chunk){
        //dbg:tracer && tracer.log("!item.data =>retry"); 
       _item.remain += chunk; 
       _item.chunk  += chunk;
      } else {
        return null;
      }
    } else {
      //dbg:tracer && tracer.log("remain item.chunkLength:"+item.chunkLength);
      //dbg:var r = _item.remain;
      //dbg:r = r.replace(/\r/g,'\\r').replace(/\n/g,'\\n'); 
      //dbg:tracer && tracer.log("remain _item.remain:"+r);
      item.remain = _item.remain.substring(item.chunkLength);
      //dbg:r = item.remain;
      //dbg:r = r.replace(/\r/g,'\\r').replace(/\n/g,'\\n');
      //dbg:tracer && tracer.log("remain item.remain:"+r);
      
      //BUG ???  if(!item.remain.length) return null;
      item.setData && item.setData(_,item.data,item.data);
      return item;
    } 
  }
  return null;
}

/// !doc
/// ## Jedi parser
/// 
/// `var jedi = require("ez-jedi")`  
/// 
/// * `parser = jedi.parser(structure)`  
///   creates a jedi parser which can be used in a ez-stream transform  
exports.parser = function(structure) {
	if(structure) {
  	return function(_, reader, writer) {
      tracer && tracer.log("jedi parse structure");
      var item=null;
      var i;
      while ((item = parseStructure(_,structure,reader,item)) != null){
        /*dbg*/tracer && tracer.log(JSON.stringify(item.data));
        writer.write(_,item.data);
      }
   	}
  } else {
    return function(_, reader, writer) {
      tracer && tracer.log("jedi parse variant");
      reader.forEach(_, function(_, _recordIn) {
        if(_recordIn && _recordIn.$type && _recordIn.$chunk) {
          try {
            var structure = require(path.resolve(_recordIn.$type ));
            structure.$parser = new typeParser(structure);
            var item = {chunk:_recordIn.$chunk};
            var i=0;
            while((item = structure.$parser(_,item)) != null) {
              writer.write(_,item.data);
              item.chunk = _recordIn.$chunk = _recordIn.$chunk.substring(item.chunkLength);
            }
          } catch(e) {
            tracer && tracer.log("exception:"+e);
          }
        }
      });
   
    }
    
  }  
}


function beforeFormatter(_type,_formatter) {
  return function(_data) {
    return (_formatter)? _type.$before + _formatter(_data) : _type.$before;
  }
}

function afterFormatter(_type,_formatter) {
  var afters = getAfters(_type.$after);
  return function(_data) {
    return (_formatter)? afters[0] + _formatter(_data) : afters[0];
  }
}

function delimitedFormatter(_type,_formatter) {
  var regex=null;
  
  if(_type.$delimited["escape"] ) {
    var specials;
    if(_type.$delimited.escape === "\\") {
      specials = [_type.$delimited.delimiter,"\\"];
    } else {
      specials = [_type.$delimited.delimiter,_type.$delimited.escape];
    }  
    regex = RegExp('[' + specials.join('\\') + ']', 'g');
  }

  return function(_data) {
    var buffer = data;
    if(regex != null){
      buffer = buffer.replace(regex, "\\$&");
    }
    buffer = _type.$delimited.delimiter + buffer + _type.$delimited.delimiter;
    return (_formatter)? buffer + _formatter(_data) : buffer;
  }
}

function objectFormatter(_type,_formatter) {

  for(var property in _type.$properties) {
    _type.$properties[property].$formatter = new typeFormatter(_type.$properties[property]);
  } 
  return function(_data) {
    var buffer="";
    //tracer && tracer.log("format object:"+JSON.stringify(_data));
    for(var property in _type.$properties) {
      buffer += _type.$properties[property].$formatter(_data[property]);
    }
    return (_formatter)? buffer + _formatter(_data) : buffer;
  }
}

function stringFormatter(_type,_formatter) {
  return function(_data) {
    var buffer = _data || "";
    tracer && tracer.log("stringFormatter:"+buffer);
    if(_type["$maxLength"]){
      buffer = buffer.substring(0,_type.$maxLength);
    } 
    return (_formatter)? buffer + _formatter(buffer) : buffer;
  }
}

function numberFormatter(_type,_formatter) {
  /*dbg*/tracer && tracer.log("numberFormatter");
  var decSep="";
  var thSep="";
  var groupSize=0;
  var precision=0;
  if (_type.$format) {
    for(var i = _type.$format.length-1;i>=0;i--) {
      //dbg:tracer && tracer.log("f:",_type.$format[i],i);
      if(_type.$format[i] === "0") {
        if(!decSep.length) ++precision;
      } else if(_type.$format[i] != "#"){
        if(0 === decSep.length) {
         decSep = _type.$format[i];
        } else if(0 === thSep.length){ 
         thSep = _type.$format[i];
        }
      }
    }
  }
  precision = (decSep.length)? precision : 0;
  var regexGroup = null;
  if(decSep.length && thSep.length) {
    groupSize = _type.$format.lastIndexOf(decSep)-_type.$format.lastIndexOf(thSep)-1;
    regexGroup = new RegExp("\.{1,"+groupSize+"}", "g")
  }
  
  return function(_data) {
    //dbg:tracer && tracer.log("format number:"+_data);
    var sign  = (_data>0)?'':'-';
    var parts = Math.abs(_data).toFixed(precision).split('.');
    if(regexGroup) {
      parts[0] = parts[0].split("").reverse().join("").match(regexGroup).join(thSep).split("").reverse().join("");
    }
    var buffer = sign + parts.join(decSep);
    return (_formatter)? buffer + _formatter(_data) : buffer;
  }
}

function dateFormatter(_type,_formatter) {
  tracer && tracer.log("dateFormatter:"+JSON.stringify(_type));
  var zeroString=Array(_type.$format.length).join("0");
  
  return function(_data) {
    var dataTokens = {
      "D": zeroString+_data.getDate().toString(),
      "M": zeroString+(_data.getMonth()+1).toString(),
      "Y": zeroString+_data.getFullYear().toString()
    };
    //dbg:tracer && tracer.log("format date:"+JSON.stringify(dataTokens));
    var buffer = "";
    for(var i = _type.$format.length-1;i>=0;i--) {
      if(_type.$format[i] in dataTokens) {
        buffer = dataTokens[_type.$format[i]].substring(dataTokens[_type.$format[i]].length-1) + buffer;
       dataTokens[_type.$format[i]] = dataTokens[_type.$format[i]].substring(0,dataTokens[_type.$format[i]].length-1);
      } else {
        buffer = _type.$format[i] + buffer;
      }
    }
    return (_formatter)? buffer + _formatter(_data) : buffer;
  }
}

function typeFormatter(_type) {
  var formatter = null;
  /*dbg*/tracer && tracer.log("new Formatter:"+_type.$type); 
  
  if(_type.$after ) {
    formatter = new afterFormatter(_type,formatter);
  }
  
  if(_type.$delimited && _type.$delimited.delimiter ) {
    formatter = new delimitedFormatter(_type,formatter);
  }
  
  switch (_type.$type || "application/x-string") {
   case "application/json"     : 
    formatter = new objectFormatter(_type,formatter);
    break;
   case "application/x-string" : 
    formatter = new stringFormatter(_type,formatter);
    break;
   case "application/x-number" : 
    formatter = new numberFormatter(_type,formatter);
    break;
   case "application/x-date"   : 
    formatter = new dateFormatter(_type,formatter);
    break;
   default     :                 
    formatter = new stringFormatter(_type,formatter);
    break;
  }
  if(_type.$before ) {
    formatter = new beforeFormatter(_type,formatter);
  }  
  return function(_data) {
    return formatter(_data);
  };
}

exports.formatter = function(_structure) {
	_structure = _structure || {};
	return function(_, reader, writer) {
	  var _variant;
    reader.forEach(_, function(_, record) {
      if(record) {
        _variant = Object.keys(record)[0];
        for(var variant in _structure.$variants) {
          if(variant === _variant) {
            /*dbg*/tracer && tracer.log("format:"+_variant);
            _structure.$variants[variant].$formatter = _structure.$variants[variant].$formatter || typeFormatter(_structure.$variants[variant]);
            writer.write(_,_structure.$variants[variant].$formatter(record[_variant]));
            break;
          }
        }
      }
    });
	};
}

exports.filter = function(_map) {
  return function(_, record){
    return (Object.keys(_map.$variants).indexOf(Object.keys(record)[0]) >= 0 );
  }
}

function objectFactory(_object) {
  return function() {
    var item = {};
    for(var property in _object.$properties) {
      _object.$properties[property].$factory = _object.$properties[property].$factory || getFactory(_object.$properties[property]);   
      item[property] = _object.$properties[property].$factory();
    }
    return item;
  }
}

function stringFactory(_type) { return function() {return "";}}
function numberFactory(_type) { return function() {return 0; }}
function dateFactory(_type)   { return function() {return new Date();}}

function getFactory(_type) {
 /*dbg*/tracer && tracer.log("new Factory:"+_type.$type); 
  switch (_type.$type || "application/x-string") {
   case "application/json"     : return new objectFactory(_type);
   case "application/x-string" : return new stringFactory(_type);
   case "application/x-number" : return new numberFactory(_type);
   case "application/x-date"   : return new dateFactory(_type);
   default     :                 return new stringFactory(_type);
  }
  return null;
}

function Transcoding(_path) {
  var tc = require(path.resolve(_path));
  for(var p in tc) {
    tc[p]["regex"] = new RegExp(tc[p].pattern);
  }
  // store intermadiate values in order to speed-up the search:
  var matchIn = [];
  var matchOut = [];
  
  this.match = function(value) {
    //dbg:tracer && tracer.log("Transcoding.match("+value+")"); 
    var i = matchIn.indexOf(value)
    if(i >= 0) {
      return matchOut[i];
    } else {
      for(var p in tc) {
        if(tc[p].regex.test(value)) {
          matchIn.push(value);
          matchOut.push(tc[p].value);
          //dbg:tracer && tracer.log("Transcoding.match("+value+")="+tc[p].value); 
          return tc[p].value;
        }
      }
    }
    return "";
  }
}

function Mapper(_structure,_name,_map,_root) {
  //dbg:tracer && tracer.log("new Mapper"+JSON.stringify(_map)); 

  var transcoding = function(_path) {
    _root["$transcoding"]     = _root["$transcoding"] || {};
    _root.$transcoding[_path] = _root.$transcoding[_path] || new Transcoding(_path);
    return _root.$transcoding[_path];
  }
  
  var befores=[];
  _root["$variables"]        = _root["$variables"] || {};
  _root.$variables["{$out}"] = _root.$variables["{$out}"] || "_recordOut";
  _root.$variables["{$in}"]  = "_recordIn";
  //dbg:tracer && tracer.log("$variables:"+_root.$variables); 
  
  
  befores.push("new function(){ return function(_ctx,_recordIn,_recordOut){");
  befores.push("_recordOut = _recordOut || {};")

  var regexNew = new RegExp(/(\{\$new\(\'(\S*)\'\)\})/);
  var regexMap = new RegExp(/(\{\$map\(\'(\S*)\'\)\})/);
 
  var match  = null;
  var statement = null;
  var outVariant = "";
  for(var o in _map.$before) { 
    statement = _map.$before[o];
    /*dbg*/tracer && tracer.log("before:"+statement); 
    if((match = regexNew.exec(_map.$before[o])) != null){
      outVariant    = match[2];
      _root.$variables["{$out}"] = "_recordOut[\""+outVariant+"\"]";
      var $new  = JSON.stringify(getFactory(_structure.$variants[outVariant])());
      $new      = $new.replace(/[\\]/g, '\\\\').replace(/[\"]/g, '\\\"');
      statement = statement.replace(match[1],"JSON.parse(\""+$new+"\")");
    } 
    if((match = regexMap.exec(_map.$before[o])) != null){
      statement = statement.replace(match[1],"transcoding(\""+match[2]+"\")");
    }
    statement = statement.replace(/(\{\$\w+\})/g, function(match) {
      return _root.$variables[match] || "_ctx.$variables[\""+match+"\"]" ;
    });
    
  
    befores.push(statement+';');
  }
  if(tracer) befores.push("tracer.log(_recordOut);");
  befores.push("return _recordOut;}}");
  var scriptBefore = befores.join("");

  /*dbg*/tracer && tracer.log("mapBefore:"+scriptBefore); 
  var mapBefore=eval(scriptBefore);
  
  if(_map.$properties  && outVariant.length) {
    for(var property in _map.$properties) {
      _map.$properties[property].$map = new mapVariant(_structure,_map.$properties[property],_root);
    }
  }
   
  return function(_ctx,_recordIn,_recordOut){
    _recordOut = mapBefore(_ctx,_recordIn,_recordOut);
   
    if(_map.$properties) {
      Object.keys(_map.$properties).forEach(function(property) {
        _map.$properties[property].$map(_ctx,_recordIn[property],_recordOut);
      });
    } 
    return _recordOut;
  }
}

function mapVariant(_structure,_variant,_root) {
  _root = _root || _variant;  
   Object.keys(_variant.$variants).forEach(function(variant){      
    _variant.$variants[variant].$map = new Mapper(_structure,variant,_variant.$variants[variant],_root);
  });
 
  return function(_ctx,_recordIn,_recordOut)  {
    var variant = Object.keys(_recordIn)[0] || "";
    tracer && tracer.log("variant:"+variant);
    return (( _variant.$variants[variant] && _variant.$variants[variant].$map(_ctx,_recordIn[variant],_recordOut)) || {} );
  }
}

exports.map = function(_map,_structure) {
  /*dbg*/tracer && tracer.log("jedi map");
  var mapvar = new mapVariant(_structure,_map);
   
  return function(_, _recordIn){
    tracer && tracer.log("jedi.map:"+JSON.stringify(_recordIn));
    return mapvar(_map,_recordIn);
  }
}  

exports.group = function(_groups) {
  tracer && tracer.log("jedi group");
  _groups = _groups || {};
  

  function FSM(_groups,_writer) {  
    function State(_name,_groups,_previousState,_writer) {
      var item =null;
      this.setItem = function(_item) {
        item = _item;
      }
      
      var actions = {};
      
      function actionFlushOut(_,_recordIn) {
          item && _writer.write(_,item);
          return item = null;
      }

      if (_previousState) {
        actions[""] = function(_,_recordIn) {
          setState(states[_previousState]);  
          // {} to manage the last null event correctly
          return (typeof _recordIn !== "undefined")? _recordIn :{};
        }
        if(_groups.$type) {
          if(_groups.$type === "application/x-array") {
            actions[_name] = function (_,_recordIn) { 
                item.push(_recordIn[_name]);
                return null;
              }
            } else {
              actions[_name] = function (_,_recordIn) { 
                 return _recordIn;
            }
          }
        } 
      } else {
        actions[""] = actionFlushOut;
      }  
      
      Object.keys(_groups).filter(function(key){return key.substring(0,1) != '$'}).forEach(function(group) {
        if(Object.keys(_groups[group]).length) {
          states[group]  = new State(group,_groups[group],_name); 
          if (_previousState) {
            if(_groups[group].$type && (_groups[group].$type === "application/x-array")) {
              actions[group] =  function(_,_recordIn) {
                if(_groups.$type === "application/x-array") {
                  item[item.length-1][group] = [];
                  setState(states[group],item[item.length-1][group]); 
                } else { 
                  item[group] = []
                  setState(states[group],item[group]); 
                }
                return _recordIn;
              }
            } else {
             actions[group] =  function(_,_recordIn) {
                item[group] = _recordIn[group];
                setState(states[group],item[group]); 
                return null;
              }
       
            }
          } else {
            actions[group] =  function(_,_recordIn) {
              actionFlushOut(_,_recordIn);           
              item = _recordIn;
              setState(states[group],item[group]);
              return null;     
              }
          }
        } else {
          if (_previousState) {
            actions[group] = function(_,_recordIn) {
                item[group] = _recordIn[group];
                return null;
              };  
          } else {
            actions[group] =  function(_,_recordIn) {
                actionFlushOut(_,_recordIn);
                _writer.write(_,_recordIn);
                return null;
              };
          }
        }
      });

      this.consume = function(_,_recordIn) {
        var event = (actions[event = _recordIn  && (typeof _recordIn== "object") && Object.keys(_recordIn)[0]] ) ? event : "";
        tracer && tracer.log("state:"+_name+" event:"+event);
        return actions[event](_,_recordIn); 
      }   
    }

    function  setState(_state,_item) {
       currentState = _state; 
      _item && currentState.setItem(_item);  
    }

    var states  = {};
    var name    = "$";
    var currentState = states[name] = new State(name,_groups,null,_writer); 

      
    return function(_,_recordIn) {     
      tracer && tracer.log("FSM event:"+ ((_recordIn && (typeof _recordIn== "object")) ? Object.keys(_recordIn)[0] :""));
      while(_recordIn = currentState.consume(_,_recordIn));  
    }
  } 

  return function(_, _reader, _writer) {
    var fsm = new FSM(_groups.$groups,_writer);  
    _reader.forEach(_, function(_, _recordIn) {
      fsm(_,_recordIn);
    });
    fsm(_);   
  }
}
