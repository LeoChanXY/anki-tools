// 全局正则替换函数
function regexReplG(orig_str, regex_str, subst_str) {
  const regex = new RegExp(regex_str, 'g');
  return orig_str.replace(regex, subst_str);
}

function regexRepl(orig_str, regex_str, subst_str) {
  const regex = new RegExp(regex_str);
  return orig_str.replace(regex, subst_str);
}
// 读取本地文件内容
function readLocalFile(e) {
  var file = e.target.files[0];
  if (!file) {
    return;
  }
  var reader = new FileReader();
  reader.onload = function(e) {
    var opml_text = e.target.result;
    var escaped_opml_text = opmlTextEscape(opml_text);
    var json_obj = OPML2JSON(escaped_opml_text);
    var markdown_str = JSON2Markdown(json_obj);
    // Display file content
    displayContents(markdown_str);
  };
  reader.readAsText(file);
}
// 对多行文本内容做必要的预处理
function preProcess(text) {
  var res_str = text;
  res_str = regexReplG(res_str.trim(), '&nbsp;', ' ');
  res_str = regexReplG(res_str.trim(), '^[\r\n]+', '');
  res_str = regexReplG(res_str.trim(), '[\r\n]+$', '');
  res_str = regexReplG(res_str.trim(), '[\r\n]+', '\n');
  return res_str;
}
function encodeHTML(text) {
  var textarea = document.createElement("textarea");
  textarea.textContent = text;
  return textarea.innerHTML;
}
function decodeHTML(html) {
  var textarea = document.createElement("textarea");
  textarea.innerHTML = html;
  return textarea.value;
}
function opmlTextEscape(opml_text) {
  const regex = '<outline text="([^"]+)"';
  var res = opml_text.match(regex);
  while(res) {
    subst = encodeHTML(res[1]);
    opml_text = regexRepl(opml_text.trim(), regex, '<outline pimgeek_text="' + subst + '"');
    res = opml_text.match(regex);
  }
  opml_text = regexReplG(opml_text, '<outline pimgeek_text=', '<outline text=');
  return opml_text;
}
// 网页文本下载
function download(filename, text) {
  var pom = document.createElement('a');
  pom.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
  pom.setAttribute('download', filename);
  
  if (document.createEvent) {
    var event = document.createEvent('MouseEvents');
    event.initEvent('click', true, true);
    pom.dispatchEvent(event);
  }
  else {
    pom.click();
  }
}
// 同步设置 TEXTAREA 编辑框内容
function setNativeValue(element, value) {
  const { set: valueSetter } = Object.getOwnPropertyDescriptor(element, 'value') || {}
  const prototype = Object.getPrototypeOf(element);
  const { set: prototypeValueSetter } = Object.getOwnPropertyDescriptor(prototype, 'value') || {}

  if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
    prototypeValueSetter.call(element, value);
  } else if (valueSetter) {
    valueSetter.call(element, value);
  } else {
    throw new Error('指定的元素没有 setter.');
  }
}
function displayContents(contents) {
  var element = document.getElementById('markdown');
  setNativeValue(element, contents);
  element.dispatchEvent(new Event('input', { bubbles: true }));
}
// 把用户输入的原始文本转换为 Outline 对象以便做后续处理
function text2Outline(text) {
  var clean_text = preProcess(text);
  var lines = clean_text.split("\n");  
  var outline = [];
  const level_regex = new RegExp('#+');
  for (var idx in lines) {
    var results = level_regex.exec(lines[idx]);
    var level = results[0].length;
    var title = lines[idx].replace(results[0], '').trim();
    var parent_idx = findParent(outline, level);
    if (parent_idx !== -1) {
        outline[parent_idx].children.push(title);
    }
    outline[idx] = { 'level': level, 'title': title, 'children': [] };
  }
  return outline;
}
// 把 OPML 字符串转换为 JSON 对象以便做后续处理
function OPML2JSON(opml) {
  var x2j = new X2JS();
  var json_obj = x2j.xml_str2json(opml);
  return json_obj;
}
// 把 JSON 对象转换为 Markdown 以便做后续处理
function JSON2Markdown(json_obj) {
  var root_item = json_obj.opml.body.outline;
  var markdown_str = convItemToMarkdownArrayByLevel(root_item, 12).join('\n');
  return markdown_str;
}

// 解析幕布专用图片格式
function imgParse(text) {
  unescaped_text = unescape(text);
  res_str = regexReplG(unescaped_text.trim(), '.*:"(.+\.jpg)"\}\]', '!\[.\]\(https://mubu.com/$1\)');
  return res_str;
}

// 获取指定大纲条目的标题
function getItemTitle(item){
  res_str = ''
  if (typeof(item) !== 'undefined') {
    res_str = decodeHTML(item["_text"]);
    if ('__mubu_text' in item) {
      res_str = decodeHTML(decodeURI(item['__mubu_text']));
    }
    if ('__images' in item) {
      res_str += imgParse(item['__images']);
    }
  }
  return res_str;
}
// 获取指定大纲条目的笔记
function getItemNote(item){
  if (typeof(item) !== 'undefined' && '__note' in item) {
    return item["__note"];
  }
  else {
    return "";
  }
}
// 获取指定大纲条目的内部条目序列
function getInsideItems(item){
  if (typeof(item) === 'undefined' || typeof(item["outline"]) === 'undefined' || ('__complete' in item && item['__complete'] === 'true')) {
    return [];
  } else if (Array.isArray(item['outline'])) {
    return item['outline'];
  } else if ((item['outline']).constructor === Object) {
    return [item['outline']];
  } else {
    return [];
  }
}
// 获取
function convItemToMarkdownArrayByLevel(item, level) {
  var md_array = [];
  var sub_md_array = [];
  if (item === 'undefined' ||('__complete' in item && item['__complete'] === 'true')) {
    return []; // 边界条件
  }
  else if (level < 0 || level > 50) {
    console.log("level 数值超出范围（0-50）！");
    return [];
  } 
  else {
    md_array.push("# " + getItemTitle(item));
    const sub_item_array = getInsideItems(item);
    if (level === 0 || typeof(sub_item_array) === 'undefined') {
      sub_md_array = [];
    } 
    else {
      var item_idx;
      for (item_idx in sub_item_array) {
        sub_md_array = sub_md_array.concat(
          convItemToMarkdownArrayByLevel(sub_item_array[item_idx], level - 1));
      }
    }
    md_array = md_array.concat(sub_md_array.map(
      function (str) { 
        if (str !== 'undefined' && str.startsWith('#')) {
          return "#" + str;
        }
        else {
          return str;
        }
      }));
  }
  return md_array;
}
// 对单行内容做 Markdown 语法解析, 并转换为 HTML 格式
function markdown2HTML(input_str) {
  let output_str = "";
  output_str = regexReplG(input_str, '\\*{2}([^\*]+)\\*{2}', '<b>$1</b>');
  output_str = regexReplG(output_str, '\\*([^\*]+)\\*', '<span style="background-color:wheat;">$1</span>');
  output_str = regexReplG(output_str, '\\!\\[[^\[]*\\]\\(([^\(\)]*)\\)', '<img src="$1">');
  return output_str;
}
// 从给定的 Outline 中识别某节点的直接父节点
// 并返回该父节点的名称
function getParentTitle(outline, child_title) {
  let parent_title = "";
  for (let item of outline) {
    if (item.hasOwnProperty('children') && 
      item.children.indexOf(child_title) >= 0) {
      parent_title = item.title;
      break;
    }
  }
  return parent_title;
}
// 从给定的 Outline 中查找某级别的上级节点
// 并返回其节点 id
// (注意是按照从下往上的顺序查找, 找到第一个就停止寻找)
function findParent(outline, child_level) {
  let parent_idx = -1;
  for (let idx = outline.length - 1; idx >= 0; idx--) {
    if (outline[idx].level == child_level - 1) {
      parent_idx = idx;
      break;
    }
  }
  return parent_idx;
}
// 从大纲中抽取章节信息
// --------
// 获取某项内容在给定的 Outline 中的 XPath
// 形如 标题1-标题1.1-标题1.1.1
function getXPathInOutline(outline, item) {
  var xpath = [];
  var parent_title = getParentTitle(outline, item.title);
  while (parent_title.length != 0) {
    xpath.unshift(markdown2HTML(parent_title));
    parent_title = getParentTitle(outline, parent_title);
  }
  return xpath.join('-');
}
function getNthLevelXPath(xpath, num) {
  var nth_level_xpath = "";
  var tmp_list = xpath.split('-').slice(0, num);
  nth_level_xpath = tmp_list.join('-');
  return nth_level_xpath;
}
function getAnkiChapterInfo(item, xpath) {
  var anki_chap_info = "";
  if (item.level == 1) {
    anki_chap_info = '《' + markdown2HTML(item.title) + '》';
  }	else if (item.level == 2) {
    anki_chap_info = '《' + xpath + '-' + markdown2HTML(item.title) + '》';
  } else {
    anki_chap_info = '《' + getNthLevelXPath(xpath, 3) + '》';
  }
  return anki_chap_info;
}
// 把用户输入的 Markdown 文本转换为 Anki Q&A 格式
function markdown2QA(markdown_text) {
  var qa_text = "";
  var outline = text2Outline(markdown_text);
  
  for (var item of outline) {
    var xpath = getXPathInOutline(outline, item);
    if (item.children.length > 0) {
      qa_text += '-----\n\n问题：' + item.title + '\n\n' +
        getAnkiChapterInfo(item, xpath) + '\n\n答案：';
      for (var child_idx in item.children) {
        if (child_idx == item.children.length - 1) {
          qa_text += item.children[child_idx] + '\n\n';
        } else {
          qa_text += item.children[child_idx] + '、';
        }
      }
    }
  }
  return qa_text;
}
// 对已经转换为 HTML 格式的文本做必要的后处理
function postProcess(input_str) {
  let output_str = "";
  output_str = regexReplG(input_str, '<img src="([^"]+)">(。|；)', '<img src="$1">');
  output_str = regexReplG(output_str, '？(。|；)', '？');
  output_str = regexReplG(output_str, '；；', '；');
  output_str = regexReplG(output_str, '。。', '。');
  return output_str;
}
// 把用户输入的 Markdown 文本转换为 AnkiCSV 导入格式
function markdown2AnkiCSV(markdown_text) {
  var anki_csv = "";
  var outline = text2Outline(markdown_text);
  
  for (var item of outline) {
    let xpath = getXPathInOutline(outline, item);
    if (item.children.length > 0) {
      anki_csv += markdown2HTML(item.title) + '\t' + 
        markdown2HTML(getAnkiChapterInfo(item, xpath)) + '\t';
      for (var child_idx in item.children) {
        if (child_idx == item.children.length - 1) {
          var tmp_str = markdown2HTML(item.children[child_idx]);
          anki_csv +=  tmp_str + '。\n';
        } else {
          var tmp_str = markdown2HTML(item.children[child_idx]);
          anki_csv +=  tmp_str + '；<br>';
        }
        anki_csv = postProcess(anki_csv);
      }
    }
  }
  return anki_csv;
}
