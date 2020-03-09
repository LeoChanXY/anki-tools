// 正则替换函数（替换所有）
function regexReplG(orig_str, regex_str, subst_str) {
  const regex = new RegExp(regex_str, 'g');
  return orig_str.replace(regex, subst_str);
}
// 正则替换函数（替换一处）
function regexRepl(orig_str, regex_str, subst_str) {
  const regex = new RegExp(regex_str);
  return orig_str.replace(regex, subst_str);
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
// 把指定内容写入 TEXTAREA
function fillTextArea(textarea_id, contents) {
  var element = document.getElementById(textarea_id);
  setNativeValue(element, contents);
  element.dispatchEvent(new Event('input', { bubbles: true }));
}
// 读取本地文件内容并做处理
function readLocalFile(e) {
  var file = e.target.files[0];
  var textarea_id = e.target.textarea_id;
  if (!file) {
    return;
  }
  var reader = new FileReader();
  reader.onload = function(e) {
    var opml_text = e.target.result;
    var escaped_opml_text = opmlTextEscape(opml_text);
    var json_obj = OPML2JSON(escaped_opml_text);
    var markdown_str = JSON2Markdown(json_obj);
    // 读取出文件内容立即写入 TEXTAREA 区域
    fillTextArea(textarea_id, markdown_str);
  };
  reader.readAsText(file);
}
// 对多行文本内容的预处理动作
function preProcess(text) {
  var res_str = text;
  res_str = regexReplG(res_str.trim(), '&nbsp;', ' ');
  res_str = regexReplG(res_str.trim(), '^[\r\n]+', '');
  res_str = regexReplG(res_str.trim(), '[\r\n]+$', '');
  res_str = regexReplG(res_str.trim(), '[\r\n]+', '\n');
  return res_str;
}
// 对文本内容中的 > < 等符号做编码处理
function encodeHTML(text) {
  var textarea = document.createElement("textarea");
  textarea.textContent = text;
  return textarea.innerHTML;
}
// 对文本内容中的 &gt; &lt; 等符号做解码处理
function decodeHTML(html) {
  var textarea = document.createElement("textarea");
  textarea.innerHTML = html;
  return textarea.value;
}
// 移除大纲文本内容中已有的超链接（针对 mubu.io）
function remove_html_link_tag(text) {
  var res_str = text;
  res_str = regexReplG(res_str.trim(), '<a class="content-link"[^>]+>([^<]+)</a>', '$1');
  return res_str;
}
// 把 opml 中的 text 属性改名为 pimgeek_text（针对 mubu.io）
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
// 获取单行 Markdown 文本的标题和级别
function getTitleAndLevel(markdown_line) {
	const level_regex = new RegExp("^#+");
	var matches = level_regex.exec(markdown_line);
	var level = matches[0].length;
	var title = markdown_line.replace(matches[0], '').trim();
	return title_n_level = { 'title': title, 'level': level };
}
// 检测是否存在子节点与父节点重名的情况
function detectDuplicateLevels(markdown_lines) {
  var clean_markdown_lines = preProcess(markdown_lines);
  var lines = clean_markdown_lines.split("\n");  
  var level_obj_array = [];
  var title_obj_array = [];
  for (var idx in lines) {
    var title_n_level = getTitleAndLevel(lines[idx]);
    level_obj_array.push(title_n_level.level);
    title_obj_array.push(title_n_level.title);
    title_obj_set = new Set(title_obj_array);
    if (title_obj_set.size < title_obj_array.length) {
      return [title_n_level.title];
    }
  }
  return [];
}
// 把 Markdown 标题序列转换为 LeveledObj 对象以便做后续处理
function text2LeveledObj(markdown_lines) {
  var clean_markdown_lines = preProcess(markdown_lines);
  var lines = clean_markdown_lines.split("\n");  
  var leveled_obj = [];
  for (var idx in lines) {
    var title_n_level = getTitleAndLevel(lines[idx]);
    var title = title_n_level.title;
    var level = title_n_level.level;
    var parent_idx = findParent(leveled_obj, level);
    if (parent_idx !== -1) {
        leveled_obj[parent_idx].children.push(title);
    }
    leveled_obj[idx] = { 'level': level, 'title': title, 'children': [] };
  }
  return leveled_obj;
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
      res_str = remove_html_link_tag(decodeHTML(decodeURI(item['__mubu_text'])));
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
// 把给定的对象逐级转换为 Markdown 文本
function convItemToMarkdownArrayByLevel(item, level) {
  var md_array = [];
  var sub_md_array = [];
  if (item === 'undefined' ||('__complete' in item && item['__complete'] === 'true')) {
    return []; // 妥善处理边界条件，避免出现异常
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
// 从给定的 LeveledObj 中识别某节点的直接父节点
// 并返回该父节点的名称
function getParentTitle(leveled_obj, child_title) {
  let parent_title = "";
  for (let item of leveled_obj) {
    if (item.hasOwnProperty('children') && 
      item.children.indexOf(child_title) >= 0) {
      parent_title = item.title;
      break;
    }
  }
  return parent_title;
}
// 从给定的 LeveledObj 中查找某级别的上级节点
// 并返回其节点 id
// (注意是按照从下往上的顺序查找, 找到第一个就停止寻找)
function findParent(leveled_obj, child_level) {
  let parent_idx = -1;
  for (let idx = leveled_obj.length - 1; idx >= 0; idx--) {
    if (leveled_obj[idx].level == child_level - 1) {
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
  var result = detectDuplicateLevels(markdown_text);
  if (result.length > 0) {
    return "存在重复的节点标题，请修正后再提交 ^_^;;\n\n【" + result[0] + "】";
  }
  
  var outline = text2LeveledObj(markdown_text);
  
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
  var result = detectDuplicateLevels(markdown_text);
  if (result.length > 0) {
    return "存在重复的节点标题，请修正后再提交 ^_^;;\n\n【" + result[0] + "】";
  }
  
  var outline = text2LeveledObj(markdown_text);
  
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
// 点击下载按钮后，利用此方法创建文件并唤起下载动作
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
