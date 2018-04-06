/*
  VGG Image Annotator (via)
  www.robots.ox.ac.uk/~vgg/software/via/

  Copyright (c) 2016-2018, Abhishek Dutta, Visual Geometry Group, Oxford University.
  All rights reserved.

  Redistribution and use in source and binary forms, with or without
  modification, are permitted provided that the following conditions are met:

  Redistributions of source code must retain the above copyright notice, this
  list of conditions and the following disclaimer.
  Redistributions in binary form must reproduce the above copyright notice,
  this list of conditions and the following disclaimer in the documentation
  and/or other materials provided with the distribution.
  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
  AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
  IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
  ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
  LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
  CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
  SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
  INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
  CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
  ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
  POSSIBILITY OF SUCH DAMAGE.
*/

/*
  See Contributors.md file for a list of developers who have contributed code
  to VIA codebase.
/*

  This source code is organized in the following groups:

  - Data structure for annotations
  - Initialization routine
  - Handlers for top navigation bar
  - Local file uploaders
  - Data Importer
  - Data Exporter
  - Maintainers of user interface
  - Image click handlers
  - Canvas update routines
  - Region collision routines
  - Shortcut key handlers
  - Persistence of annotation data in browser cache (i.e. localStorage)
  - Handlers for attributes input panel (spreadsheet like user input panel)

  See [Source code documentation](https://gitlab.com/vgg/via/blob/develop/CodeDoc.md)
  and [Contributing Guidelines](https://gitlab.com/vgg/via/blob/develop/CONTRIBUTING.md)
  for more details.

*/

"use strict";

var VIA_VERSION      = '1.1.0';
var VIA_NAME         = 'VGG Image Annotator';
var VIA_SHORT_NAME   = 'VIA';
var VIA_REGION_SHAPE = { RECT:'rect',
                         CIRCLE:'circle',
                         ELLIPSE:'ellipse',
                         POLYGON:'polygon',
                         POINT:'point',
                         POLYLINE:'polyline'
                       };

var VIA_ATTRIBUTE_TYPE = { TEXT:'text',
                           CHECKBOX:'checkbox',
                           RADIO:'radio',
                           IMAGE:'image'
                         };

var VIA_DISPLAY_AREA_CONTENT_NAME = {IMAGE:'image_panel',
                                     IMAGE_GRID:'image_grid_panel',
                                     SETTINGS:'settings_panel',
                                     PAGE_HELP:'page_help',
                                     PAGE_ABOUT:'page_about',
                                     PAGE_START_INFO:'page_start_info',
                                     PAGE_LICENSE:'page_license'
                                    };

var VIA_REGION_EDGE_TOL           = 5;   // pixel
var VIA_REGION_CONTROL_POINT_SIZE = 2;
var VIA_REGION_POINT_RADIUS       = 3;
var VIA_POLYGON_VERTEX_MATCH_TOL  = 5;
var VIA_REGION_MIN_DIM            = 3;
var VIA_MOUSE_CLICK_TOL           = 2;
var VIA_ELLIPSE_EDGE_TOL          = 0.2; // euclidean distance
var VIA_THETA_TOL                 = Math.PI/18; // 10 degrees
var VIA_POLYGON_RESIZE_VERTEX_OFFSET    = 100;
var VIA_CANVAS_DEFAULT_ZOOM_LEVEL_INDEX = 3;
var VIA_CANVAS_ZOOM_LEVELS = [0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 2.5, 3.0, 4, 5];

var VIA_THEME_REGION_BOUNDARY_WIDTH = 4;
var VIA_THEME_BOUNDARY_LINE_COLOR   = "#1a1a1a";
var VIA_THEME_BOUNDARY_FILL_COLOR   = "#aaeeff";
var VIA_THEME_SEL_REGION_FILL_COLOR = "#808080";
var VIA_THEME_SEL_REGION_FILL_BOUNDARY_COLOR = "#000000";
var VIA_THEME_SEL_REGION_OPACITY    = 0.5;
var VIA_THEME_MESSAGE_TIMEOUT_MS    = 6000;
var VIA_THEME_ATTRIBUTE_VALUE_FONT  = '10pt Sans';
var VIA_THEME_CONTROL_POINT_COLOR   = '#ff0000';

var VIA_CSV_SEP        = ',';
var VIA_CSV_QUOTE_CHAR = '"';
var VIA_CSV_KEYVAL_SEP = ':';
var VIA_IMPORT_CSV_COMMENT_CHAR = '#';

var _via_img_metadata = {};   // data structure to store loaded images metadata
var _via_img_count    = 0;    // count of the loaded images
var _via_canvas_regions = []; // image regions spec. in canvas space
var _via_canvas_scale   = 1.0;// current scale of canvas image

var _via_image_id_list  = []; // array of image id (in original order)
var _via_image_id       = ''; // id={filename+length} of current image
var _via_image_index    = -1; // index

var _via_current_image_filename;
var _via_current_image = document.getElementById('image_content');
var _via_current_image_width;
var _via_current_image_height;

// image canvas
var _via_img_content = document.getElementById("image_content");
var _via_reg_canvas  = document.getElementById("region_canvas");
var _via_reg_ctx     = _via_reg_canvas.getContext("2d");
var _via_canvas_width, _via_canvas_height;

// canvas zoom
var _via_canvas_zoom_level_index   = VIA_CANVAS_DEFAULT_ZOOM_LEVEL_INDEX; // 1.0
var _via_canvas_scale_without_zoom = 1.0;

// state of the application
var _via_is_user_drawing_region  = false;
var _via_current_image_loaded    = false;
var _via_is_window_resized       = false;
var _via_is_user_resizing_region = false;
var _via_is_user_moving_region   = false;
var _via_is_user_drawing_polygon = false;
var _via_is_region_selected      = false;
var _via_is_all_region_selected  = false;
var _via_is_user_updating_attribute_name  = false;
var _via_is_user_updating_attribute_value = false;
var _via_is_user_adding_attribute_name    = false;
var _via_is_loaded_img_list_visible  = false;
var _via_is_attributes_panel_visible = false;
var _via_is_reg_attr_panel_visible   = false;
var _via_is_file_attr_panel_visible  = false;
var _via_is_canvas_zoomed            = false;
var _via_is_loading_current_image    = false;
var _via_is_region_id_visible        = true;
var _via_is_region_boundary_visible  = true;
var _via_is_ctrl_pressed             = false;

// region
var _via_current_shape             = VIA_REGION_SHAPE.RECT;
var _via_current_polygon_region_id = -1;
var _via_user_sel_region_id        = -1;
var _via_click_x0 = 0; var _via_click_y0 = 0;
var _via_click_x1 = 0; var _via_click_y1 = 0;
var _via_region_click_x, _via_region_click_y;
var _via_region_edge          = [-1, -1];
var _via_current_x = 0; var _via_current_y = 0;

// region copy/paste
var _via_copied_image_regions = [];
var _via_paste_to_multiple_images_input;

// message
var _via_message_clear_timer;

// attributes
var _via_attribute_being_updated       = 'region'; // {region, file}
var _via_attributes                    = { 'region':{}, 'file':{} };

// invoke a method after receiving user input
var _via_user_input_ok_handler     = null;
var _via_user_input_cancel_handler = null;
var _via_user_input_data           = {};

// annotation editor
var _via_metadata_being_updated     = 'region'; // {region, file}

// persistence to local storage
var _via_is_local_storage_available = false;
var _via_is_save_ongoing            = false;

// image list
var _via_reload_img_fn_list_table      = true;
var _via_loaded_img_fn_list            = [];
var _via_loaded_img_fn_list_file_index = [];
var _via_loaded_img_fn_list_table_html = [];

// image grid
var image_grid_panel = document.getElementById('image_grid_panel');
var _via_image_grid_requires_update              = false;
var _via_image_grid_content_overflow             = false;
var _via_image_grid_current_page_first_img_index = 0;
var _via_image_grid_total_pages                  = -1;
var _via_image_grid_selected_fileid_list         = [];
var _via_image_grid_current_page_fileid_list     = [];
var _via_display_area_content_name               = '';
var _via_image_grid_mousedown_img_index = -1;
var _via_image_grid_mouseup_img_index = -1;

// via settings
var _via_settings = {};
_via_settings.ui = {};
_via_settings.ui.annotation_editor_height   = 25; // in percent of the height of browser window
_via_settings.ui.annotation_editor_fontsize = 0.8;// in rem
_via_settings.ui.image_grid_panel_img_height= 5;  // in percent

// UI html elements
var invisible_file_input = document.getElementById("invisible_file_input");
var display_area = document.getElementById("display_area");
var ui_top_panel = document.getElementById("ui_top_panel");
var image_panel  = document.getElementById("image_panel");

var annotation_list_snippet = document.getElementById("annotation_list_snippet");
var annotation_textarea     = document.getElementById("annotation_textarea");

var img_fn_list_panel     = document.getElementById('img_fn_list_panel');
var img_fn_list           = document.getElementById('img_fn_list');
var attributes_panel      = document.getElementById('attributes_panel');

var BBOX_LINE_WIDTH       = 4;
var BBOX_SELECTED_OPACITY = 0.3;
var BBOX_BOUNDARY_FILL_COLOR_ANNOTATED = "#f2f2f2";
var BBOX_BOUNDARY_FILL_COLOR_NEW       = "#aaeeff";
var BBOX_BOUNDARY_LINE_COLOR           = "#1a1a1a";
var BBOX_SELECTED_FILL_COLOR           = "#ffffff";

var VIA_ANNOTATION_EDITOR_HEIGHT_CHANGE   = 5;   // in percent
var VIA_ANNOTATION_EDITOR_FONTSIZE_CHANGE = 0.1; // in rem
var VIA_IMAGE_GRID_IMG_HEIGHT_CHANGE      = 1; // in percent

//
// Data structure for annotations
//
function ImageMetadata(fileref, filename, size) {
  this.filename = filename;
  this.size     = size;
  this.fileref  = fileref;          // image url or local file ref.
  this.regions  = [];
  this.file_attributes = {};        // image attributes
  this.base64_img_data = '';        // image data stored as base 64
}

function ImageRegion() {
  this.is_user_selected  = false;
  this.shape_attributes  = {}; // region shape attributes
  this.region_attributes = {}; // region attributes
}

//
// Initialization routine
//
function _via_init() {
  console.log(VIA_NAME);
  show_message(VIA_NAME + ' (' + VIA_SHORT_NAME + ') version ' + VIA_VERSION +
               '. Ready !', 2*VIA_THEME_MESSAGE_TIMEOUT_MS);

  // initialize default project
  project_init_default_project();

  // initialize image grid
  image_grid_init();

  show_single_image_view();
  init_leftsidebar_accordion();
  attribute_update_panel_set_active_button();
  annotation_editor_set_active_button();
  init_message_panel();

  _via_is_local_storage_available = check_local_storage();
  if (_via_is_local_storage_available) {
    if (is_via_data_in_localStorage()) {
      show_localStorage_recovery_options();
    }
  }

  // run attached sub-modules (if any)
  if (typeof _via_load_submodules === 'function') {
    setTimeout(function() {
      _via_load_submodules();
    }, 100);
  }
}

//
// Display area content
//
function clear_display_area() {
  var panels = document.getElementsByClassName('display_area_content');
  var i;
  for ( i = 0; i < panels.length; ++i ) {
    panels[i].classList.add('display_none');
  }
}

function is_content_name_valid(content_name) {
  var e;
  for ( e in VIA_DISPLAY_AREA_CONTENT_NAME ) {
    if ( VIA_DISPLAY_AREA_CONTENT_NAME[e] === content_name ) {
      return true;
    }
  }
  return false;
}

function show_home_panel() {
  show_single_image_view();
}

function set_display_area_content(content_name) {
  if ( is_content_name_valid(content_name) ) {
    clear_display_area();
    var p = document.getElementById(content_name);
    p.classList.remove('display_none');
    _via_display_area_content_name = content_name;
  }
}

function show_single_image_view() {
  if (_via_current_image_loaded) {
    set_display_area_content(VIA_DISPLAY_AREA_CONTENT_NAME.IMAGE);
  } else {
    set_display_area_content(VIA_DISPLAY_AREA_CONTENT_NAME.PAGE_START_INFO);
  }
}

function show_image_grid_view() {
  if (_via_current_image_loaded) {
    set_display_area_content(VIA_DISPLAY_AREA_CONTENT_NAME.IMAGE_GRID);
    image_grid_update();
  } else {
    set_display_area_content(VIA_DISPLAY_AREA_CONTENT_NAME.PAGE_START_INFO);
  }
}

//
// Handlers for top navigation bar
//
function sel_local_images() {
  // source: https://developer.mozilla.org/en-US/docs/Using_files_from_web_applications
  if (invisible_file_input) {
    invisible_file_input.setAttribute('multiple', 'multiple')
    invisible_file_input.accept   = '.jpg,.jpeg,.png,.bmp';
    invisible_file_input.onchange = project_file_add_local;
    invisible_file_input.click();
  }
}
function download_all_region_data(type) {
  // Javascript strings (DOMString) is automatically converted to utf-8
  // see: https://developer.mozilla.org/en-US/docs/Web/API/Blob/Blob
  var all_region_data = pack_via_metadata(type);
  var blob_attr = {type: 'text/'+type+';charset=utf-8'};
  var all_region_data_blob = new Blob(all_region_data, blob_attr);

  if ( all_region_data_blob.size > (2*1024*1024) &&
       type === 'csv' ) {
    show_message('CSV file size is ' + (all_region_data_blob.size/(1024*1024)) +
                 ' MB. We advise you to instead download as JSON');
  } else {
    save_data_to_local_file(all_region_data_blob, 'via_region_data.'+type);
  }
}

function sel_local_data_file(type) {
  if (invisible_file_input) {
    invisible_file_input.accept='.csv,.json';
    switch(type) {
    case 'annotations':
      invisible_file_input.onchange = import_annotations_from_file;
      break;

    case 'attributes':
      invisible_file_input.onchange = import_attributes_from_file;
      break;

    default:
      return;
    }
    invisible_file_input.removeAttribute('multiple');
    invisible_file_input.click();
  }
}

//
// Data Importer
//

function import_region_attributes_from_file(event) {
  var selected_files = event.target.files;
  for ( var i=0 ; i < selected_files.length; ++i ) {
    var file = selected_files[i];
    switch(file.type) {
    case 'text/csv':
      load_text_file(file, import_region_attributes_from_csv);
      break;

    default:
      show_message('Region attributes cannot be imported from file of type ' + file.type);
      break;
    }
  }
}

function import_region_attributes_from_csv(data) {
  data = data.replace(/\n/g, ''); // discard newline \n
  var csvdata = data.split(',');
  var attributes_import_count = 0;
  for ( var i = 0; i < csvdata.length; ++i ) {
    if ( !_via_region_attributes.hasOwnProperty(csvdata[i]) ) {
      _via_region_attributes[csvdata[i]] = true;
      attributes_import_count += 1;
    }
  }

  _via_reload_img_fn_list_table = true;
  show_message('Imported ' + attributes_import_count + ' attributes from CSV file');
  save_current_data_to_browser_cache();
}

function import_annotations_from_file(event) {
  var selected_files = event.target.files;
  for ( var i = 0; i < selected_files.length; ++i ) {
    var file = selected_files[i];
    switch(file.type) {
    case '': // Fall-through // Windows 10: Firefox and Chrome do not report filetype
      show_message('File type for ' + file.name + ' cannot be determined! Assuming text/plain.');
    case 'text/plain': // Fall-through
    case 'application/vnd.ms-excel': // Fall-through // @todo: filetype of VIA csv annotations in Windows 10 , fix this (reported by @Eli Walker)
    case 'text/csv':
      load_text_file(file, import_annotations_from_csv);
      break;

    case 'text/json': // Fall-through
    case 'application/json':
      load_text_file(file, import_annotations_from_json);
      break;

    default:
      show_message('Annotations cannot be imported from file of type ' + file.type);
      break;
    }
  }
}
function import_annotations_from_csv(data) {
  if ( data === '' || typeof(data) === 'undefined') {
    return;
  }

  // csv header format
  // #filename,file_size,file_attributes,region_count,region_id,region_shape_attributes,region_attributes
  var filename_index = 0;
  var size_index = 1;
  var file_attr_index = 2;
  var region_shape_attr_index = 5;
  var region_attr_index = 6;
  var csv_column_count = 7;

  var region_import_count = 0;
  var malformed_csv_lines_count = 0;

  var line_split_regex = new RegExp('\n|\r|\r\n', 'g');
  var csvdata = data.split(line_split_regex);

  var parsed_header = parse_csv_header_line(csvdata[0]);
  if ( ! parsed_header.is_header ) {
    show_message('Header line missing in CSV file');
    return;
  }

  for ( var i=1; i < csvdata.length; ++i ) {
    // ignore blank lines
    if (csvdata[i].charAt(0) === '\n' || csvdata[i].charAt(0) === '') {
      continue;
    }

    var d = parse_csv_line(csvdata[i]);

    // check if csv line was malformed
    if ( d.length !== parsed_header.csv_column_count ) {
      malformed_csv_lines_count += 1;
      continue;
    }

    var filename = d[filename_index];
    var size     = d[size_index];
    var image_id = _via_get_image_id(filename, size);

    if ( _via_img_metadata.hasOwnProperty(image_id) ) {
      // copy file attributes
      if ( d[parsed_header.file_attr_index] !== '"{}"') {
        var fattr = d[parsed_header.file_attr_index];
        fattr     = remove_prefix_suffix_quotes( fattr );
        fattr     = unescape_from_csv( fattr );

        var m = json_str_to_map( fattr );
        for( var key in m ) {
          _via_img_metadata[image_id].file_attributes[key] = m[key];

          // add this file attribute to _via_attributes
          if ( ! _via_attributes['file'].hasOwnProperty(key) ) {
            _via_attributes['file'][key] = { 'type':'text' };
          }
        }
      }

      var region_i = new ImageRegion();
      // copy regions shape attributes
      if ( d[parsed_header.region_shape_attr_index] !== '"{}"' ) {
        var sattr = d[parsed_header.region_shape_attr_index];
        sattr     = remove_prefix_suffix_quotes( sattr );
        sattr     = unescape_from_csv( sattr );

        var m = json_str_to_map( sattr );
        for ( var key in m ) {
          region_i.shape_attributes[key] = m[key];
        }
      }

      // copy region attributes
      if ( d[parsed_header.region_attr_index] !== '"{}"' ) {
        var rattr = d[parsed_header.region_attr_index];
        rattr     = remove_prefix_suffix_quotes( rattr );
        rattr     = unescape_from_csv( rattr );

        var m = json_str_to_map( rattr );
        for ( var key in m ) {
          region_i.region_attributes[key] = m[key];

          // add this region attribute to _via_attributes
          if ( ! _via_attributes['region'].hasOwnProperty(key) ) {
            _via_attributes['region'][key] = { 'type':'text' };
          }
        }
      }

      // add regions only if they are present
      if (Object.keys(region_i.shape_attributes).length > 0 ||
          Object.keys(region_i.region_attributes).length > 0 ) {
        _via_img_metadata[image_id].regions.push(region_i);
        region_import_count += 1;
      }
    }
  }
  show_message('Import Summary : [' + region_import_count + '] regions, ' +
               '[' + malformed_csv_lines_count  + '] malformed csv lines.');

  update_attributes_update_panel();
  update_annotation_editor();

  show_image(_via_image_index);
  save_current_data_to_browser_cache();
}

function parse_csv_header_line(line) {
  var header_via_10x = '#filename,file_size,file_attributes,region_count,region_id,region_shape_attributes,region_attributes'; // VIA versions 1.0.x
  var header_via_11x = 'filename,file_size,file_attributes,region_count,region_id,region_shape_attributes,region_attributes'; // VIA version 1.1.x

  if ( line === header_via_10x || line === header_via_11x ) {
    return { 'is_header':true,
             'filename_index': 0,
             'size_index': 1,
             'file_attr_index': 2,
             'region_shape_attr_index': 5,
             'region_attr_index': 6,
             'csv_column_count': 7
           }
  } else {
    return { 'is_header':false };
  }
}

function import_annotations_from_json(data) {
  if (data === '' || typeof(data) === 'undefined') {
    return;
  }

  var d = JSON.parse(data);

  var region_import_count = 0;
  for (var image_id in d) {
    if ( _via_img_metadata.hasOwnProperty(image_id) ) {

      // copy image attributes
      for (var key in d[image_id].file_attributes) {
        if ( !_via_img_metadata[image_id].file_attributes[key] ) {
          _via_img_metadata[image_id].file_attributes[key] = d[image_id].file_attributes[key];
        }

        // add this file attribute to _via_attributes
        if ( ! _via_attributes['file'].hasOwnProperty(key) ) {
          _via_attributes['file'][key] = { 'type':'text' };
        }
      }

      // copy regions
      var regions = d[image_id].regions;
      for ( var i in regions ) {
        var region_i = new ImageRegion();
        for ( var key in regions[i].shape_attributes ) {
          region_i.shape_attributes[key] = regions[i].shape_attributes[key];
        }
        for ( var key in regions[i].region_attributes ) {
          region_i.region_attributes[key] = regions[i].region_attributes[key];

          // add this region attribute to _via_attributes
          if ( ! _via_attributes['region'].hasOwnProperty(key) ) {
            _via_attributes['region'][key] = { 'type':'text' };
          }
        }

        // add regions only if they are present
        if ( Object.keys(region_i.shape_attributes).length > 0 ||
             Object.keys(region_i.region_attributes).length > 0 ) {
          _via_img_metadata[image_id].regions.push(region_i);
          region_import_count += 1;
        }
      }
    }
  }
  show_message('Import Summary : [' + region_import_count + '] regions');

  update_attributes_update_panel();
  update_annotation_editor();

  show_image(_via_image_index);
}

// assumes that csv line follows the RFC 4180 standard
// see: https://en.wikipedia.org/wiki/Comma-separated_values
function parse_csv_line(s, field_separator) {
  if (typeof(s) === 'undefined' || s.length === 0 ) {
    return [];
  }

  if (typeof(field_separator) === 'undefined') {
    field_separator = ',';
  }
  var double_quote_seen = false;
  var start = 0;
  var d = [];

  var i = 0;
  while ( i < s.length) {
    if (s.charAt(i) === field_separator) {
      if (double_quote_seen) {
        // field separator inside double quote is ignored
        i = i + 1;
      } else {
        //var part = s.substr(start, i - start);
        d.push( s.substr(start, i - start) );
        start = i + 1;
        i = i + 1;
      }
    } else {
      if (s.charAt(i) === '"') {
        if (double_quote_seen) {
          if (s.charAt(i+1) === '"') {
            // ignore escaped double quotes
            i = i + 2;
          } else {
            // closing of double quote
            double_quote_seen = false;
            i = i + 1;
          }
        } else {
          double_quote_seen = true;
          start = i;
          i = i + 1;
        }
      } else {
        i = i + 1;
      }
    }

  }
  // extract the last field (csv rows have no trailing comma)
  d.push( s.substr(start) );
  return d;
}

// s = '{"name":"rect","x":188,"y":90,"width":243,"height":233}'
function json_str_to_map(s) {
  if (typeof(s) === 'undefined' || s.length === 0 ) {
    return {};
  }

  return JSON.parse(s);
}

// ensure the exported json string conforms to RFC 4180
// see: https://en.wikipedia.org/wiki/Comma-separated_values
function map_to_json(m) {
  var s = [];
  for ( var key in m ) {
    var v   = m[key];
    var si  = JSON.stringify(key);
    si += VIA_CSV_KEYVAL_SEP;
    si += JSON.stringify(v);
    s.push( si );
  }
  return '{' + s.join(VIA_CSV_SEP) + '}';
}

function escape_for_csv(s) {
  return s.replace(/["]/g, '""');
}

function unescape_from_csv(s) {
  return s.replace(/""/g, '"');
}

function remove_prefix_suffix_quotes(s) {
  if ( s.charAt(0) === '"' && s.charAt(s.length-1) === '"' ) {
    return s.substr(1, s.length-2);
  } else {
    return s;
  }
}

function clone_image_region(r0) {
  var r1 = new ImageRegion();
  r1.is_user_selected = r0.is_user_selected;

  // copy shape attributes
  for ( var key in r0.shape_attributes ) {
    r1.shape_attributes[key] = clone_value(r0.shape_attributes[key]);
  }

  // copy region attributes
  for ( var key in r0.region_attributes ) {
    r1.region_attributes[key] = clone_value(r0.region_attributes[key]);
  }
  return r1;
}

function clone_value(value) {
  if ( typeof(value) === 'object' ) {
    if ( Array.isArray(value) ) {
      return value.slice(0);
    } else {
      var copy = {};
      for ( var p in value ) {
        if ( value.hasOwnProperty(p) ) {
          copy[p] = clone_value(value[p]);
        }
      }
      return copy;
    }
  }
  return value;
}

function _via_get_image_id(filename, size) {
  if ( typeof(size) === 'undefined' ) {
    return filename;
  } else {
    return filename + size;
  }
}

function load_text_file(text_file, callback_function) {
  if (text_file) {
    var text_reader = new FileReader();
    text_reader.addEventListener( 'progress', function(e) {
      show_message('Loading data from text file : ' + text_file.name + ' ... ');
    }, false);

    text_reader.addEventListener( 'error', function() {
      show_message('Error loading data from text file :  ' + text_file.name + ' !');
      callback_function('');
    }, false);

    text_reader.addEventListener( 'load', function() {
      callback_function(text_reader.result);
    }, false);
    text_reader.readAsText(text_file, 'utf-8');
  }
}

//
// Data Exporter
//
function pack_via_metadata(return_type) {
  if( return_type === 'csv' ) {
    var csvdata = [];
    var csvheader = 'filename,file_size,file_attributes,region_count,region_id,region_shape_attributes,region_attributes';
    csvdata.push(csvheader);

    for ( var image_id in _via_img_metadata ) {
      var fattr = map_to_json( _via_img_metadata[image_id].file_attributes );
      fattr = escape_for_csv( fattr );

      var prefix = '\n' + _via_img_metadata[image_id].filename;
      prefix += ',' + _via_img_metadata[image_id].size;
      prefix += ',"' + fattr + '"';

      var r = _via_img_metadata[image_id].regions;

      if ( r.length !==0 ) {
        for ( var i = 0; i < r.length; ++i ) {
          var csvline = [];
          csvline.push(prefix);
          csvline.push(r.length);
          csvline.push(i);

          var sattr = map_to_json( r[i].shape_attributes );
          sattr = '"' +  escape_for_csv( sattr ) + '"';
          csvline.push(sattr);

          var rattr = map_to_json( r[i].region_attributes );
          rattr = '"' +  escape_for_csv( rattr ) + '"';
          csvline.push(rattr);
          csvdata.push( csvline.join(VIA_CSV_SEP) );
        }
      } else {
        // @todo: reconsider this practice of adding an empty entry
        csvdata.push(prefix + ',0,0,"{}","{}"');
      }
    }
    return csvdata;
  } else {
    // remove the data that is not needed
    var _via_img_metadata_as_obj = {};
    for ( var image_id in _via_img_metadata ) {
      var image_data = {};
      //image_data.fileref = _via_img_metadata[image_id].fileref;
      image_data.fileref = '';
      image_data.size = _via_img_metadata[image_id].size;
      image_data.filename = _via_img_metadata[image_id].filename;
      image_data.base64_img_data = '';
      //image_data.base64_img_data = _via_img_metadata[image_id].base64_img_data;

      // copy file attributes
      image_data.file_attributes = {};
      for ( var key in _via_img_metadata[image_id].file_attributes ) {
        image_data.file_attributes[key] = _via_img_metadata[image_id].file_attributes[key];
      }

      // copy all region shape_attributes
      image_data.regions = {};
      for ( var i = 0; i < _via_img_metadata[image_id].regions.length; ++i ) {
        image_data.regions[i] = {};
        image_data.regions[i].shape_attributes = {};
        image_data.regions[i].region_attributes = {};
        // copy region shape_attributes
        for ( var key in _via_img_metadata[image_id].regions[i].shape_attributes ) {
          image_data.regions[i].shape_attributes[key] = _via_img_metadata[image_id].regions[i].shape_attributes[key];
        }
        // copy region_attributes
        for ( var key in _via_img_metadata[image_id].regions[i].region_attributes ) {
          image_data.regions[i].region_attributes[key] = _via_img_metadata[image_id].regions[i].region_attributes[key];
        }
      }
      _via_img_metadata_as_obj[image_id] = image_data;
    }
    return [JSON.stringify(_via_img_metadata_as_obj)];
  }
}

function save_data_to_local_file(data, filename) {
  var a      = document.createElement('a');
  a.href     = URL.createObjectURL(data);
  a.target   = '_blank';
  a.download = filename;

  // simulate a mouse click event
  var event = new MouseEvent('click', {
    view: window,
    bubbles: true,
    cancelable: true
  });

  a.dispatchEvent(event);
}

//
// Maintainers of user interface
//

function init_message_panel() {
  var p = document.getElementById('message_panel');
  p.addEventListener('mousedown', function() {
    this.style.display = 'none';
  }, false);
  p.addEventListener('mouseover', function() {
    clearTimeout(_via_message_clear_timer); // stop any previous timeouts
  }, false);
}

function show_message(msg, t) {
  if ( _via_message_clear_timer ) {
    clearTimeout(_via_message_clear_timer); // stop any previous timeouts
  }
  var timeout = t;
  if ( typeof t === 'undefined' ) {
    timeout = VIA_THEME_MESSAGE_TIMEOUT_MS;
  }
  document.getElementById('message_panel_content').innerHTML = msg;
  document.getElementById('message_panel').style.display = 'block';

  _via_message_clear_timer = setTimeout( function() {
    document.getElementById('message_panel_content').innerHTML = '';
    document.getElementById('message_panel').style.display = 'none';
  }, timeout);
}

function show_image(image_index) {
  if (_via_is_loading_current_image) {
    return;
  }

  var img_id = _via_image_id_list[image_index];
  if ( !_via_img_metadata.hasOwnProperty(img_id)) {
    return;
  }

  var img_filename = _via_img_metadata[img_id].filename;
  var img_reader = new FileReader();
  _via_is_loading_current_image = true;

  img_reader.addEventListener( "loadstart", function(e) {
    img_loading_spinbar(image_index, true);
  }, false);

  img_reader.addEventListener( "progress", function(e) {
  }, false);

  img_reader.addEventListener( "error", function() {
    _via_is_loading_current_image = false;
    img_loading_spinbar(image_index, false);
    show_message("Error loading image " + img_filename + " !");
  }, false);

  img_reader.addEventListener( "abort", function() {
    _via_is_loading_current_image = false;
    img_loading_spinbar(image_index, false);
    show_message("Aborted loading image " + img_filename + " !");
  }, false);

  img_reader.addEventListener( "load", function() {
    //_via_current_image = new Image();

    _via_current_image.addEventListener( "error", function() {
      _via_is_loading_current_image = false;
      img_loading_spinbar(image_index, false);
      show_message("Error loading image " + img_filename + " !");
    }, false);

    _via_current_image.addEventListener( "abort", function() {
      _via_is_loading_current_image = false;
      img_loading_spinbar(image_index, false);
      show_message("Aborted loading image " + img_filename + " !");
    }, false);

    _via_current_image.addEventListener( "load", function() {

      // update the current state of application
      _via_image_id = img_id;
      _via_image_index = image_index;
      _via_current_image_filename = img_filename;
      _via_current_image_loaded = true;
      _via_is_loading_current_image = false;
      _via_click_x0 = 0; _via_click_y0 = 0;
      _via_click_x1 = 0; _via_click_y1 = 0;
      _via_is_user_drawing_region = false;
      _via_is_window_resized = false;
      _via_is_user_resizing_region = false;
      _via_is_user_moving_region = false;
      _via_is_user_drawing_polygon = false;
      _via_is_region_selected = false;
      _via_user_sel_region_id = -1;
      _via_current_image_width = _via_current_image.naturalWidth;
      _via_current_image_height = _via_current_image.naturalHeight;

      // set the size of canvas
      // based on the current dimension of browser window
      var de = document.documentElement;
      var image_panel_width = de.clientWidth - 230;
      var image_panel_height = de.clientHeight - 2*ui_top_panel.offsetHeight;
      _via_canvas_width = _via_current_image_width;
      _via_canvas_height = _via_current_image_height;
      if ( _via_canvas_width > image_panel_width ) {
        // resize image to match the panel width
        var scale_width = image_panel_width / _via_current_image.naturalWidth;
        _via_canvas_width = image_panel_width;
        _via_canvas_height = _via_current_image.naturalHeight * scale_width;
      }
      if ( _via_canvas_height > image_panel_height ) {
        // resize further image if its height is larger than the image panel
        var scale_height = image_panel_height / _via_canvas_height;
        _via_canvas_height = image_panel_height;
        _via_canvas_width = _via_canvas_width * scale_height;
      }
      _via_canvas_width = Math.round(_via_canvas_width);
      _via_canvas_height = Math.round(_via_canvas_height);
      _via_canvas_scale = _via_current_image.naturalWidth / _via_canvas_width;
      _via_canvas_scale_without_zoom = _via_canvas_scale;
      set_all_canvas_size(_via_canvas_width, _via_canvas_height);
      //set_all_canvas_scale(_via_canvas_scale_without_zoom);

      // ensure that all the canvas are visible
      set_display_area_content( VIA_DISPLAY_AREA_CONTENT_NAME.IMAGE );

      img_loading_spinbar(image_index, false);

      // refresh the image list
      _via_reload_img_fn_list_table = true;
      update_img_fn_list();

      // refresh the annotations panel
      update_annotation_editor();

      _via_load_canvas_regions(); // image to canvas space transform
      _via_redraw_reg_canvas();
      _via_reg_canvas.focus();

      // Preserve zoom level
      if (_via_is_canvas_zoomed) {
        set_zoom( _via_canvas_zoom_level_index );
      }
    });
    _via_current_image.src = img_reader.result;
  }, false);

  if (_via_img_metadata[img_id].base64_img_data === '') {
    if ( _via_img_metadata[img_id].fileref instanceof File ) {
      // load image from local file
      // we only need to draw the image once in the image_canvas
      img_reader.readAsDataURL( _via_img_metadata[img_id].fileref );
    } else {
      // load image from url
      img_reader.readAsText( new Blob([_via_img_metadata[img_id].fileref]) );
    }
  } else {
    // load image from base64 data or URL
    img_reader.readAsText( new Blob([_via_img_metadata[img_id].base64_img_data]) );
  }
}

// transform regions in image space to canvas space
function _via_load_canvas_regions() {
  // load all existing annotations into _via_canvas_regions
  var regions = _via_img_metadata[_via_image_id].regions;
  _via_canvas_regions  = [];
  for ( var i = 0; i < regions.length; ++i ) {
    var region_i = new ImageRegion();
    for ( var key in regions[i].shape_attributes ) {
      region_i.shape_attributes[key] = regions[i].shape_attributes[key];
    }
    _via_canvas_regions.push(region_i);

    switch(_via_canvas_regions[i].shape_attributes['name']) {
    case VIA_REGION_SHAPE.RECT:
      var x      = regions[i].shape_attributes['x'] / _via_canvas_scale;
      var y      = regions[i].shape_attributes['y'] / _via_canvas_scale;
      var width  = regions[i].shape_attributes['width']  / _via_canvas_scale;
      var height = regions[i].shape_attributes['height'] / _via_canvas_scale;

      _via_canvas_regions[i].shape_attributes['x'] = Math.round(x);
      _via_canvas_regions[i].shape_attributes['y'] = Math.round(y);
      _via_canvas_regions[i].shape_attributes['width'] = Math.round(width);
      _via_canvas_regions[i].shape_attributes['height'] = Math.round(height);
      break;

    case VIA_REGION_SHAPE.CIRCLE:
      var cx = regions[i].shape_attributes['cx'] / _via_canvas_scale;
      var cy = regions[i].shape_attributes['cy'] / _via_canvas_scale;
      var r  = regions[i].shape_attributes['r']  / _via_canvas_scale;
      _via_canvas_regions[i].shape_attributes['cx'] = Math.round(cx);
      _via_canvas_regions[i].shape_attributes['cy'] = Math.round(cy);
      _via_canvas_regions[i].shape_attributes['r'] = Math.round(r);
      break;

    case VIA_REGION_SHAPE.ELLIPSE:
      var cx = regions[i].shape_attributes['cx'] / _via_canvas_scale;
      var cy = regions[i].shape_attributes['cy'] / _via_canvas_scale;
      var rx = regions[i].shape_attributes['rx'] / _via_canvas_scale;
      var ry = regions[i].shape_attributes['ry'] / _via_canvas_scale;
      _via_canvas_regions[i].shape_attributes['cx'] = Math.round(cx);
      _via_canvas_regions[i].shape_attributes['cy'] = Math.round(cy);
      _via_canvas_regions[i].shape_attributes['rx'] = Math.round(rx);
      _via_canvas_regions[i].shape_attributes['ry'] = Math.round(ry);
      break;

    case VIA_REGION_SHAPE.POLYLINE: // handled by polygon
    case VIA_REGION_SHAPE.POLYGON:
      var all_points_x = regions[i].shape_attributes['all_points_x'].slice(0);
      var all_points_y = regions[i].shape_attributes['all_points_y'].slice(0);
      for (var j=0; j<all_points_x.length; ++j) {
        all_points_x[j] = Math.round(all_points_x[j] / _via_canvas_scale);
        all_points_y[j] = Math.round(all_points_y[j] / _via_canvas_scale);
      }
      _via_canvas_regions[i].shape_attributes['all_points_x'] = all_points_x;
      _via_canvas_regions[i].shape_attributes['all_points_y'] = all_points_y;
      break;

    case VIA_REGION_SHAPE.POINT:
      var cx = regions[i].shape_attributes['cx'] / _via_canvas_scale;
      var cy = regions[i].shape_attributes['cy'] / _via_canvas_scale;

      _via_canvas_regions[i].shape_attributes['cx'] = Math.round(cx);
      _via_canvas_regions[i].shape_attributes['cy'] = Math.round(cy);
      break;
    }
  }
}

// updates currently selected region shape
function select_region_shape(sel_shape_name) {
  for ( var shape_name in VIA_REGION_SHAPE ) {
    var ui_element = document.getElementById('region_shape_' + VIA_REGION_SHAPE[shape_name]);
    ui_element.classList.remove('selected');
  }

  _via_current_shape = sel_shape_name;
  var ui_element = document.getElementById('region_shape_' + _via_current_shape);
  ui_element.classList.add('selected');

  switch(_via_current_shape) {
  case VIA_REGION_SHAPE.RECT: // Fall-through
  case VIA_REGION_SHAPE.CIRCLE: // Fall-through
  case VIA_REGION_SHAPE.ELLIPSE:
    show_message('Press single click and drag mouse to draw ' +
                 _via_current_shape + ' region');
    break;

  case VIA_REGION_SHAPE.POLYLINE:
  case VIA_REGION_SHAPE.POLYGON:
    _via_is_user_drawing_polygon = false;
    _via_current_polygon_region_id = -1;

    show_message('[Enter] to finish, [Esc] to cancel, ' +
                 '[Click] to define polygon/polyline vertices')
    break;

  case VIA_REGION_SHAPE.POINT:
    show_message('Press single click to define points (or landmarks)');
    break;

  default:
    show_message('Unknown shape selected!');
    break;
  }
}

function set_all_canvas_size(w, h) {
  _via_reg_canvas.height = h;
  _via_reg_canvas.width = w;

  image_panel.style.height = h + 'px';
  image_panel.style.width  = w + 'px';
}

function set_all_canvas_scale(s) {
  _via_reg_ctx.scale(s, s);
}

function show_all_canvas() {
  image_panel.style.display = 'inline-block';
}

function hide_all_canvas() {
  image_panel.style.display = 'none';
}

function jump_to_image(image_index) {
  if ( _via_img_count <= 0 ) {
    return;
  }

  if ( image_index >= 0 && image_index < _via_img_count) {
    show_image(image_index);
  }
}

function count_missing_region_attr(img_id) {
  var miss_region_attr_count = 0;
  var attr_count = Object.keys(_via_region_attributes).length;
  for( var i=0; i < _via_img_metadata[img_id].regions.length; ++i ) {
    var set_attr_count = Object.keys(_via_img_metadata[img_id].regions[i].region_attributes).length;
    miss_region_attr_count += ( attr_count - set_attr_count );
  }
  return miss_region_attr_count;
}

function count_missing_file_attr(img_id) {
  return Object.keys(_via_file_attributes).length - Object.keys(_via_img_metadata[img_id].file_attributes).length;
}

function toggle_all_regions_selection(is_selected) {
  for (var i=0; i<_via_canvas_regions.length; ++i) {
    _via_canvas_regions[i].is_user_selected = is_selected;
    _via_img_metadata[_via_image_id].regions[i].is_user_selected = is_selected;
  }
  _via_is_all_region_selected = is_selected;
}
function select_only_region(region_id) {
  toggle_all_regions_selection(false);
  set_region_select_state(region_id, true);
  _via_is_region_selected = true;
  _via_user_sel_region_id = region_id;
}
function set_region_select_state(region_id, is_selected) {
  _via_canvas_regions[region_id].is_user_selected = is_selected;
  _via_img_metadata[_via_image_id].regions[region_id].is_user_selected = is_selected;
}

function show_annotation_data() {
  var hstr = '<pre>' + pack_via_metadata('csv').join('') + '</pre>';
  var window_features = 'toolbar=no,menubar=no,location=no,resizable=yes,scrollbars=yes,status=no';
  window_features += ',width=800,height=600';
  var annotation_data_window = window.open('', 'Annotations (preview) ', window_features);
  annotation_data_window.document.body.innerHTML = hstr;
}

//
// Image click handlers
//

// enter annotation mode on double click
_via_reg_canvas.addEventListener('dblclick', function(e) {
  _via_click_x0 = e.offsetX; _via_click_y0 = e.offsetY;
  var region_id = is_inside_region(_via_click_x0, _via_click_y0);

  if (region_id !== -1) {
    // user clicked inside a region, show attribute panel
    var p = document.getElementById('annotation_editor_panel');
    if ( ! p.classList.contains('display_block') ) {
      p.classList.add('display_block');
      p.style.height = _via_settings.ui.annotation_editor_height + '%';
      update_annotation_editor();
    }
  }

}, false);

// user clicks on the canvas
_via_reg_canvas.addEventListener('mousedown', function(e) {
  _via_click_x0 = e.offsetX; _via_click_y0 = e.offsetY;
  _via_region_edge = is_on_region_corner(_via_click_x0, _via_click_y0);
  var region_id = is_inside_region(_via_click_x0, _via_click_y0);

  if ( _via_is_region_selected ) {
    // check if user clicked on the region boundary
    if ( _via_region_edge[1] > 0 ) {
      if ( !_via_is_user_resizing_region ) {
        // resize region
        if ( _via_region_edge[0] !== _via_user_sel_region_id ) {
          _via_user_sel_region_id = _via_region_edge[0];
        }
        _via_is_user_resizing_region = true;
      }
    } else {
      var yes = is_inside_this_region(_via_click_x0,
                                      _via_click_y0,
                                      _via_user_sel_region_id);
      if (yes) {
        if( !_via_is_user_moving_region ) {
          _via_is_user_moving_region = true;
          _via_region_click_x = _via_click_x0;
          _via_region_click_y = _via_click_y0;
        }
      }
      if ( region_id === -1 ) {
        // mousedown on outside any region
        _via_is_user_drawing_region = true;
        // unselect all regions
        _via_is_region_selected = false;
        _via_user_sel_region_id = -1;
        toggle_all_regions_selection(false);
      }
    }
  } else {
    if ( region_id === -1 ) {
      // mousedown outside a region
      if (_via_current_shape !== VIA_REGION_SHAPE.POLYGON &&
          _via_current_shape !== VIA_REGION_SHAPE.POLYLINE &&
          _via_current_shape !== VIA_REGION_SHAPE.POINT) {
        // this is a bounding box drawing event
        _via_is_user_drawing_region = true;
      }
    } else {
      // mousedown inside a region
      // this could lead to (1) region selection or (2) region drawing
      _via_is_user_drawing_region = true;
    }
  }
  e.preventDefault();
}, false);

// implements the following functionalities:
//  - new region drawing (including polygon)
//  - moving/resizing/select/unselect existing region
_via_reg_canvas.addEventListener('mouseup', function(e) {
  _via_click_x1 = e.offsetX; _via_click_y1 = e.offsetY;

  var click_dx = Math.abs(_via_click_x1 - _via_click_x0);
  var click_dy = Math.abs(_via_click_y1 - _via_click_y0);

  // indicates that user has finished moving a region
  if ( _via_is_user_moving_region ) {
    _via_is_user_moving_region = false;
    _via_reg_canvas.style.cursor = "default";

    var move_x = Math.round(_via_click_x1 - _via_region_click_x);
    var move_y = Math.round(_via_click_y1 - _via_region_click_y);

    if (Math.abs(move_x) > VIA_MOUSE_CLICK_TOL ||
        Math.abs(move_y) > VIA_MOUSE_CLICK_TOL) {

      var image_attr = _via_img_metadata[_via_image_id].regions[_via_user_sel_region_id].shape_attributes;
      var canvas_attr = _via_canvas_regions[_via_user_sel_region_id].shape_attributes;

      switch( canvas_attr['name'] ) {
      case VIA_REGION_SHAPE.RECT:
        var xnew = image_attr['x'] + Math.round(move_x * _via_canvas_scale);
        var ynew = image_attr['y'] + Math.round(move_y * _via_canvas_scale);
        image_attr['x'] = xnew;
        image_attr['y'] = ynew;

        canvas_attr['x'] = Math.round( image_attr['x'] / _via_canvas_scale);
        canvas_attr['y'] = Math.round( image_attr['y'] / _via_canvas_scale);
        break;

      case VIA_REGION_SHAPE.CIRCLE: // Fall-through
      case VIA_REGION_SHAPE.ELLIPSE: // Fall-through
      case VIA_REGION_SHAPE.POINT:
        var cxnew = image_attr['cx'] + Math.round(move_x * _via_canvas_scale);
        var cynew = image_attr['cy'] + Math.round(move_y * _via_canvas_scale);
        image_attr['cx'] = cxnew;
        image_attr['cy'] = cynew;

        canvas_attr['cx'] = Math.round( image_attr['cx'] / _via_canvas_scale);
        canvas_attr['cy'] = Math.round( image_attr['cy'] / _via_canvas_scale);
        break;

      case VIA_REGION_SHAPE.POLYLINE: // handled by polygon
      case VIA_REGION_SHAPE.POLYGON:
        var img_px = image_attr['all_points_x'];
        var img_py = image_attr['all_points_y'];
        for (var i=0; i<img_px.length; ++i) {
          img_px[i] = img_px[i] + Math.round(move_x * _via_canvas_scale);
          img_py[i] = img_py[i] + Math.round(move_y * _via_canvas_scale);
        }

        var canvas_px = canvas_attr['all_points_x'];
        var canvas_py = canvas_attr['all_points_y'];
        for (var i=0; i<canvas_px.length; ++i) {
          canvas_px[i] = Math.round( img_px[i] / _via_canvas_scale );
          canvas_py[i] = Math.round( img_py[i] / _via_canvas_scale );
        }
        break;
      }
    } else {
      // indicates a user click on an already selected region
      // this could indicate a user's intention to select another
      // nested region within this region

      // traverse the canvas regions in alternating ascending
      // and descending order to solve the issue of nested regions
      var nested_region_id = is_inside_region(_via_click_x0, _via_click_y0, true);
      if (nested_region_id >= 0 &&
          nested_region_id !== _via_user_sel_region_id) {
        _via_user_sel_region_id = nested_region_id;
        _via_is_region_selected = true;
        _via_is_user_moving_region = false;

        // de-select all other regions if the user has not pressed Shift
        if ( !e.shiftKey ) {
          toggle_all_regions_selection(false);
        }
        set_region_select_state(nested_region_id, true);
        update_annotation_editor();
      }
    }
    _via_redraw_reg_canvas();
    _via_reg_canvas.focus();
    save_current_data_to_browser_cache();
    return;
  }

  // indicates that user has finished resizing a region
  if ( _via_is_user_resizing_region ) {
    // _via_click(x0,y0) to _via_click(x1,y1)
    _via_is_user_resizing_region = false;
    _via_reg_canvas.style.cursor = "default";

    // update the region
    var region_id = _via_region_edge[0];
    var image_attr = _via_img_metadata[_via_image_id].regions[region_id].shape_attributes;
    var canvas_attr = _via_canvas_regions[region_id].shape_attributes;

    switch (canvas_attr['name']) {
    case VIA_REGION_SHAPE.RECT:
      var d = [canvas_attr['x'], canvas_attr['y'], 0, 0];
      d[2] = d[0] + canvas_attr['width'];
      d[3] = d[1] + canvas_attr['height'];

      var mx = _via_current_x;
      var my = _via_current_y;
      var preserve_aspect_ratio = false;

      // constrain (mx,my) to lie on a line connecting a diagonal of rectangle
      if ( _via_is_ctrl_pressed ) {
        preserve_aspect_ratio = true;
      }

      rect_update_corner(_via_region_edge[1], d, mx, my, preserve_aspect_ratio);
      rect_standardize_coordinates(d);

      var w = Math.abs(d[2] - d[0]);
      var h = Math.abs(d[3] - d[1]);

      image_attr['x'] = Math.round(d[0] * _via_canvas_scale);
      image_attr['y'] = Math.round(d[1] * _via_canvas_scale);
      image_attr['width'] = Math.round(w * _via_canvas_scale);
      image_attr['height'] = Math.round(h * _via_canvas_scale);

      canvas_attr['x'] = Math.round( image_attr['x'] / _via_canvas_scale);
      canvas_attr['y'] = Math.round( image_attr['y'] / _via_canvas_scale);
      canvas_attr['width'] = Math.round( image_attr['width'] / _via_canvas_scale);
      canvas_attr['height'] = Math.round( image_attr['height'] / _via_canvas_scale);
      break;

    case VIA_REGION_SHAPE.CIRCLE:
      var dx = Math.abs(canvas_attr['cx'] - _via_current_x);
      var dy = Math.abs(canvas_attr['cy'] - _via_current_y);
      var new_r = Math.sqrt( dx*dx + dy*dy );

      image_attr['r'] = Math.round(new_r * _via_canvas_scale);
      canvas_attr['r'] = Math.round( image_attr['r'] / _via_canvas_scale);
      break;

    case VIA_REGION_SHAPE.ELLIPSE:
      var new_rx = canvas_attr['rx'];
      var new_ry = canvas_attr['ry'];
      var dx = Math.abs(canvas_attr['cx'] - _via_current_x);
      var dy = Math.abs(canvas_attr['cy'] - _via_current_y);

      switch(_via_region_edge[1]) {
      case 5:
        new_ry = dy;
        break;

      case 6:
        new_rx = dx;
        break;

      default:
        new_rx = dx;
        new_ry = dy;
        break;
      }

      image_attr['rx'] = Math.round(new_rx * _via_canvas_scale);
      image_attr['ry'] = Math.round(new_ry * _via_canvas_scale);

      canvas_attr['rx'] = Math.round(image_attr['rx'] / _via_canvas_scale);
      canvas_attr['ry'] = Math.round(image_attr['ry'] / _via_canvas_scale);
      break;

    case VIA_REGION_SHAPE.POLYLINE: // handled by polygon
    case VIA_REGION_SHAPE.POLYGON:
      var moved_vertex_id = _via_region_edge[1] - VIA_POLYGON_RESIZE_VERTEX_OFFSET;

      var imx = Math.round(_via_current_x * _via_canvas_scale);
      var imy = Math.round(_via_current_y * _via_canvas_scale);
      image_attr['all_points_x'][moved_vertex_id] = imx;
      image_attr['all_points_y'][moved_vertex_id] = imy;
      canvas_attr['all_points_x'][moved_vertex_id] = Math.round( imx / _via_canvas_scale );
      canvas_attr['all_points_y'][moved_vertex_id] = Math.round( imy / _via_canvas_scale );

      if (moved_vertex_id === 0 && canvas_attr['name'] === VIA_REGION_SHAPE.POLYGON) {
        // move both first and last vertex because we
        // the initial point at the end to close path
        var n = canvas_attr['all_points_x'].length;
        image_attr['all_points_x'][n-1] = imx;
        image_attr['all_points_y'][n-1] = imy;
        canvas_attr['all_points_x'][n-1] = Math.round( imx / _via_canvas_scale );
        canvas_attr['all_points_y'][n-1] = Math.round( imy / _via_canvas_scale );
      }
      break;
    }

    _via_redraw_reg_canvas();
    _via_reg_canvas.focus();
    save_current_data_to_browser_cache();
    return;
  }

  // denotes a single click (= mouse down + mouse up)
  if ( click_dx < VIA_MOUSE_CLICK_TOL ||
       click_dy < VIA_MOUSE_CLICK_TOL ) {
    // if user is already drawing polygon, then each click adds a new point
    if ( _via_is_user_drawing_polygon ) {
      var canvas_x0 = Math.round(_via_click_x0);
      var canvas_y0 = Math.round(_via_click_y0);

      // check if the clicked point is close to the first point
      var fx0 = _via_canvas_regions[_via_current_polygon_region_id].shape_attributes['all_points_x'][0];
      var fy0 = _via_canvas_regions[_via_current_polygon_region_id].shape_attributes['all_points_y'][0];
      var  dx = (fx0 - canvas_x0);
      var  dy = (fy0 - canvas_y0);
      // @todo: add test for the inner area delimited by the enclosed polygon to have at least a minimum given value
      if ( Math.sqrt(dx*dx + dy*dy) <= VIA_POLYGON_VERTEX_MATCH_TOL &&
           _via_canvas_regions[_via_current_polygon_region_id].shape_attributes['all_points_x'].length >= 3 ) {
        // user clicked on the first polygon point to close the path and the polygon has at least 3 points defined
        _via_is_user_drawing_polygon = false;

        // add all polygon points stored in _via_canvas_regions[]
        var all_points_x = _via_canvas_regions[_via_current_polygon_region_id].shape_attributes['all_points_x'].slice(0);
        var all_points_y = _via_canvas_regions[_via_current_polygon_region_id].shape_attributes['all_points_y'].slice(0);
        // close path - this will make any final, polygon region to contain at least 4 points
        all_points_x.push(all_points_x[0]);
        all_points_y.push(all_points_y[0]);

        var canvas_all_points_x = [];
        var canvas_all_points_y = [];

        //var points_str = '';
        for ( var i=0; i<all_points_x.length; ++i ) {
          all_points_x[i] = Math.round( all_points_x[i] * _via_canvas_scale );
          all_points_y[i] = Math.round( all_points_y[i] * _via_canvas_scale );

          canvas_all_points_x[i] = Math.round( all_points_x[i] / _via_canvas_scale );
          canvas_all_points_y[i] = Math.round( all_points_y[i] / _via_canvas_scale );

          //points_str += all_points_x[i] + ' ' + all_points_y[i] + ',';
        }
        //points_str = points_str.substring(0, points_str.length-1); // remove last comma

        var polygon_region = new ImageRegion();
        polygon_region.shape_attributes['name'] = 'polygon';
        //polygon_region.shape_attributes['points'] = points_str;
        polygon_region.shape_attributes['all_points_x'] = all_points_x;
        polygon_region.shape_attributes['all_points_y'] = all_points_y;
        _via_current_polygon_region_id = _via_img_metadata[_via_image_id].regions.length;
        _via_img_metadata[_via_image_id].regions.push(polygon_region);

        // update canvas
        _via_canvas_regions[_via_current_polygon_region_id].shape_attributes['all_points_x'] = canvas_all_points_x;
        _via_canvas_regions[_via_current_polygon_region_id].shape_attributes['all_points_y'] = canvas_all_points_y;

        // newly drawn region is automatically selected
        select_only_region(_via_current_polygon_region_id);

        _via_current_polygon_region_id = -1;
        update_annotation_editor();
        save_current_data_to_browser_cache();
      } else {
        // user clicked on a new polygon point
        _via_canvas_regions[_via_current_polygon_region_id].shape_attributes['all_points_x'].push(canvas_x0);
        _via_canvas_regions[_via_current_polygon_region_id].shape_attributes['all_points_y'].push(canvas_y0);
      }
    } else {
      var region_id = is_inside_region(_via_click_x0, _via_click_y0);
      if ( region_id >= 0 ) {
        // first click selects region
        _via_user_sel_region_id     = region_id;
        _via_is_region_selected     = true;
        _via_is_user_moving_region  = false;
        _via_is_user_drawing_region = false;

        // de-select all other regions if the user has not pressed Shift
        if ( !e.shiftKey ) {
          annotation_editor_clear_row_highlight();
          toggle_all_regions_selection(false);
        }
        set_region_select_state(region_id, true);
        annotation_editor_scroll_to_row(region_id);
        annotation_editor_highlight_row(region_id);
      } else {
        if ( _via_is_user_drawing_region ) {
          // clear all region selection
          _via_is_user_drawing_region = false;
          _via_is_region_selected     = false;
          toggle_all_regions_selection(false);
          annotation_editor_clear_row_highlight();
        } else {
          switch (_via_current_shape) {
          case VIA_REGION_SHAPE.POLYLINE: // handled by case for POLYGON
          case VIA_REGION_SHAPE.POLYGON:
            // user has clicked on the first point in a new polygon
            _via_is_user_drawing_polygon = true;

            var canvas_polygon_region = new ImageRegion();
            canvas_polygon_region.shape_attributes['name'] = _via_current_shape;
            canvas_polygon_region.shape_attributes['all_points_x'] = [Math.round(_via_click_x0)];
            canvas_polygon_region.shape_attributes['all_points_y'] = [Math.round(_via_click_y0)];
            _via_canvas_regions.push(canvas_polygon_region);
            _via_current_polygon_region_id =_via_canvas_regions.length - 1;
            break;

          case VIA_REGION_SHAPE.POINT:
            // user has marked a landmark point
            var point_region = new ImageRegion();
            point_region.shape_attributes['name'] = VIA_REGION_SHAPE.POINT;
            point_region.shape_attributes['cx'] = Math.round(_via_click_x0 * _via_canvas_scale);
            point_region.shape_attributes['cy'] = Math.round(_via_click_y0 * _via_canvas_scale);
            _via_img_metadata[_via_image_id].regions.push(point_region);

            var canvas_point_region = new ImageRegion();
            canvas_point_region.shape_attributes['name'] = VIA_REGION_SHAPE.POINT;
            canvas_point_region.shape_attributes['cx'] = Math.round(_via_click_x0);
            canvas_point_region.shape_attributes['cy'] = Math.round(_via_click_y0);
            _via_canvas_regions.push(canvas_point_region);

            update_annotation_editor();
            save_current_data_to_browser_cache();
            break;
          }
        }
      }
    }
    _via_redraw_reg_canvas();
    _via_reg_canvas.focus();
    return;
  }

  // indicates that user has finished drawing a new region
  if ( _via_is_user_drawing_region ) {

    _via_is_user_drawing_region = false;

    var region_x0, region_y0, region_x1, region_y1;
    // ensure that (x0,y0) is top-left and (x1,y1) is bottom-right
    if ( _via_click_x0 < _via_click_x1 ) {
      region_x0 = _via_click_x0;
      region_x1 = _via_click_x1;
    } else {
      region_x0 = _via_click_x1;
      region_x1 = _via_click_x0;
    }

    if ( _via_click_y0 < _via_click_y1 ) {
      region_y0 = _via_click_y0;
      region_y1 = _via_click_y1;
    } else {
      region_y0 = _via_click_y1;
      region_y1 = _via_click_y0;
    }

    var original_img_region = new ImageRegion();
    var canvas_img_region = new ImageRegion();
    var region_dx = Math.abs(region_x1 - region_x0);
    var region_dy = Math.abs(region_y1 - region_y0);

    // newly drawn region is automatically selected
    toggle_all_regions_selection(false);
    original_img_region.is_user_selected = true;
    canvas_img_region.is_user_selected = true;
    _via_is_region_selected = true;
    _via_user_sel_region_id = _via_canvas_regions.length; // new region's id

    if ( region_dx > VIA_REGION_MIN_DIM ||
         region_dy > VIA_REGION_MIN_DIM ) { // avoid regions with 0 dim
        switch(_via_current_shape) {
        case VIA_REGION_SHAPE.RECT:
          var x = Math.round(region_x0 * _via_canvas_scale);
          var y = Math.round(region_y0 * _via_canvas_scale);
          var width  = Math.round(region_dx * _via_canvas_scale);
          var height = Math.round(region_dy * _via_canvas_scale);
          original_img_region.shape_attributes['name'] = 'rect';
          original_img_region.shape_attributes['x'] = x;
          original_img_region.shape_attributes['y'] = y;
          original_img_region.shape_attributes['width'] = width;
          original_img_region.shape_attributes['height'] = height;

          canvas_img_region.shape_attributes['name'] = 'rect';
          canvas_img_region.shape_attributes['x'] = Math.round( x / _via_canvas_scale );
          canvas_img_region.shape_attributes['y'] = Math.round( y / _via_canvas_scale );
          canvas_img_region.shape_attributes['width'] = Math.round( width / _via_canvas_scale );
          canvas_img_region.shape_attributes['height'] = Math.round( height / _via_canvas_scale );

          _via_img_metadata[_via_image_id].regions.push(original_img_region);
          _via_canvas_regions.push(canvas_img_region);
          break;

        case VIA_REGION_SHAPE.CIRCLE:
          var cx = Math.round(region_x0 * _via_canvas_scale);
          var cy = Math.round(region_y0 * _via_canvas_scale);
          var r  = Math.round( Math.sqrt(region_dx*region_dx + region_dy*region_dy) * _via_canvas_scale );

          original_img_region.shape_attributes['name'] = 'circle';
          original_img_region.shape_attributes['cx'] = cx;
          original_img_region.shape_attributes['cy'] = cy;
          original_img_region.shape_attributes['r'] = r;

          canvas_img_region.shape_attributes['name'] = 'circle';
          canvas_img_region.shape_attributes['cx'] = Math.round( cx / _via_canvas_scale );
          canvas_img_region.shape_attributes['cy'] = Math.round( cy / _via_canvas_scale );
          canvas_img_region.shape_attributes['r'] = Math.round( r / _via_canvas_scale );

          _via_img_metadata[_via_image_id].regions.push(original_img_region);
          _via_canvas_regions.push(canvas_img_region);
          break;

        case VIA_REGION_SHAPE.ELLIPSE:
          var cx = Math.round(region_x0 * _via_canvas_scale);
          var cy = Math.round(region_y0 * _via_canvas_scale);
          var rx = Math.round(region_dx * _via_canvas_scale);
          var ry = Math.round(region_dy * _via_canvas_scale);

          original_img_region.shape_attributes['name'] = 'ellipse';
          original_img_region.shape_attributes['cx'] = cx;
          original_img_region.shape_attributes['cy'] = cy;
          original_img_region.shape_attributes['rx'] = rx;
          original_img_region.shape_attributes['ry'] = ry;

          canvas_img_region.shape_attributes['name'] = 'ellipse';
          canvas_img_region.shape_attributes['cx'] = Math.round( cx / _via_canvas_scale );
          canvas_img_region.shape_attributes['cy'] = Math.round( cy / _via_canvas_scale );
          canvas_img_region.shape_attributes['rx'] = Math.round( rx / _via_canvas_scale );
          canvas_img_region.shape_attributes['ry'] = Math.round( ry / _via_canvas_scale );

          _via_img_metadata[_via_image_id].regions.push(original_img_region);
          _via_canvas_regions.push(canvas_img_region);
          break;

        case VIA_REGION_SHAPE.POLYLINE: // handled by case VIA_REGION_SHAPE.POLYGON
        case VIA_REGION_SHAPE.POLYGON:
          // handled by _via_is_user_drawing polygon
          break;
        }
    } else {
      show_message('Prevented accidental addition of a very small region.');
    }
    set_region_annotations_to_default_value( _via_user_sel_region_id );
    annotation_editor_add_row( _via_user_sel_region_id );
    annotation_editor_scroll_to_row( _via_user_sel_region_id );
    annotation_editor_clear_row_highlight();
    annotation_editor_highlight_row( _via_user_sel_region_id );
    _via_redraw_reg_canvas();
    _via_reg_canvas.focus();

    save_current_data_to_browser_cache();
    return;
  }

});

_via_reg_canvas.addEventListener("mouseover", function(e) {
  // change the mouse cursor icon
  _via_redraw_reg_canvas();
  _via_reg_canvas.focus();
});

_via_reg_canvas.addEventListener('mousemove', function(e) {
  if ( !_via_current_image_loaded ) {
    return;
  }

  _via_current_x = e.offsetX; _via_current_y = e.offsetY;

  if ( _via_is_region_selected ) {
    if ( !_via_is_user_resizing_region ) {
      // check if user moved mouse cursor to region boundary
      // which indicates an intention to resize the region

      _via_region_edge = is_on_region_corner(_via_current_x, _via_current_y);

      if ( _via_region_edge[0] === _via_user_sel_region_id ) {
        switch(_via_region_edge[1]) {
          // rect
        case 1: // Fall-through // top-left corner of rect
        case 3: // bottom-right corner of rect
          _via_reg_canvas.style.cursor = "nwse-resize";
          break;
        case 2: // Fall-through // top-right corner of rect
        case 4: // bottom-left corner of rect
          _via_reg_canvas.style.cursor = "nesw-resize";
          break;

        case 5: // Fall-through // top-middle point of rect
        case 7: // bottom-middle point of rect
          _via_reg_canvas.style.cursor = "ns-resize";
          break;
        case 6: // Fall-through // top-middle point of rect
        case 8: // bottom-middle point of rect
          _via_reg_canvas.style.cursor = "ew-resize";
          break;

          // circle and ellipse
        case 5:
          _via_reg_canvas.style.cursor = "n-resize";
          break;
        case 6:
          _via_reg_canvas.style.cursor = "e-resize";
          break;

        default:
          _via_reg_canvas.style.cursor = "default";
          break;
        }

        if (_via_region_edge[1] >= VIA_POLYGON_RESIZE_VERTEX_OFFSET) {
          // indicates mouse over polygon vertex
          _via_reg_canvas.style.cursor = "crosshair";
        }
      } else {
        var yes = is_inside_this_region(_via_current_x,
                                        _via_current_y,
                                        _via_user_sel_region_id);
        if (yes) {
          _via_reg_canvas.style.cursor = "move";
        } else {
          _via_reg_canvas.style.cursor = "default";
        }
      }
    }
  }

  if(_via_is_user_drawing_region) {
    // draw region as the user drags the mouse cursor
    if (_via_canvas_regions.length) {
      _via_redraw_reg_canvas(); // clear old intermediate rectangle
    } else {
      // first region being drawn, just clear the full region canvas
      _via_reg_ctx.clearRect(0, 0, _via_reg_canvas.width, _via_reg_canvas.height);
    }

    var region_x0, region_y0;

    if ( _via_click_x0 < _via_current_x ) {
      if ( _via_click_y0 < _via_current_y ) {
        region_x0 = _via_click_x0;
        region_y0 = _via_click_y0;
      } else {
        region_x0 = _via_click_x0;
        region_y0 = _via_current_y;
      }
    } else {
      if ( _via_click_y0 < _via_current_y ) {
        region_x0 = _via_current_x;
        region_y0 = _via_click_y0;
      } else {
        region_x0 = _via_current_x;
        region_y0 = _via_current_y;
      }
    }
    var dx = Math.round(Math.abs(_via_current_x - _via_click_x0));
    var dy = Math.round(Math.abs(_via_current_y - _via_click_y0));

    switch (_via_current_shape ) {
    case VIA_REGION_SHAPE.RECT:
      _via_draw_rect_region(region_x0, region_y0, dx, dy, false);
      break;

    case VIA_REGION_SHAPE.CIRCLE:
      var circle_radius = Math.round(Math.sqrt( dx*dx + dy*dy ));
      _via_draw_circle_region(region_x0, region_y0, circle_radius, false);
      break;

    case VIA_REGION_SHAPE.ELLIPSE:
      _via_draw_ellipse_region(region_x0, region_y0, dx, dy, false);
      break;

    case VIA_REGION_SHAPE.POLYLINE: // handled by polygon
    case VIA_REGION_SHAPE.POLYGON:
      // this is handled by the if ( _via_is_user_drawing_polygon ) { ... }
      // see below
      break;
    }
    _via_reg_canvas.focus();
  }

  if ( _via_is_user_resizing_region ) {
    // user has clicked mouse on bounding box edge and is now moving it
    // draw region as the user drags the mouse coursor
    if (_via_canvas_regions.length) {
      _via_redraw_reg_canvas(); // clear old intermediate rectangle
    } else {
      // first region being drawn, just clear the full region canvas
      _via_reg_ctx.clearRect(0, 0, _via_reg_canvas.width, _via_reg_canvas.height);
    }

    var region_id = _via_region_edge[0];
    var attr = _via_canvas_regions[region_id].shape_attributes;
    switch (attr['name']) {
    case VIA_REGION_SHAPE.RECT:
      // original rectangle
      var d = [attr['x'], attr['y'], 0, 0];
      d[2] = d[0] + attr['width'];
      d[3] = d[1] + attr['height'];

      var mx = _via_current_x;
      var my = _via_current_y;
      var preserve_aspect_ratio = false;
      // constrain (mx,my) to lie on a line connecting a diagonal of rectangle
      if ( _via_is_ctrl_pressed ) {
        preserve_aspect_ratio = true;
      }

      rect_update_corner(_via_region_edge[1], d, mx, my, preserve_aspect_ratio);
      rect_standardize_coordinates(d);

      var w = Math.abs(d[2] - d[0]);
      var h = Math.abs(d[3] - d[1]);
      _via_draw_rect_region(d[0], d[1], w, h, true);
      break;

    case VIA_REGION_SHAPE.CIRCLE:
      var dx = Math.abs(attr['cx'] - _via_current_x);
      var dy = Math.abs(attr['cy'] - _via_current_y);
      var new_r = Math.sqrt( dx*dx + dy*dy );
      _via_draw_circle_region(attr['cx'],
                              attr['cy'],
                              new_r,
                              true);
      break;

    case VIA_REGION_SHAPE.ELLIPSE:
      var new_rx = attr['rx'];
      var new_ry = attr['ry'];
      var dx = Math.abs(attr['cx'] - _via_current_x);
      var dy = Math.abs(attr['cy'] - _via_current_y);
      switch(_via_region_edge[1]) {
      case 5:
        new_ry = dy;
        break;

      case 6:
        new_rx = dx;
        break;

      default:
        new_rx = dx;
        new_ry = dy;
        break;
      }
      _via_draw_ellipse_region(attr['cx'],
                               attr['cy'],
                               new_rx,
                               new_ry,
                               true);
      break;

    case VIA_REGION_SHAPE.POLYLINE: // handled by polygon
    case VIA_REGION_SHAPE.POLYGON:
      var moved_all_points_x = attr['all_points_x'].slice(0);
      var moved_all_points_y = attr['all_points_y'].slice(0);
      var moved_vertex_id = _via_region_edge[1] - VIA_POLYGON_RESIZE_VERTEX_OFFSET;

      moved_all_points_x[moved_vertex_id] = _via_current_x;
      moved_all_points_y[moved_vertex_id] = _via_current_y;

      if (moved_vertex_id === 0 && attr['name'] === VIA_REGION_SHAPE.POLYGON) {
        // move both first and last vertex because we
        // the initial point at the end to close path
        moved_all_points_x[moved_all_points_x.length-1] = _via_current_x;
        moved_all_points_y[moved_all_points_y.length-1] = _via_current_y;
      }
      _via_draw_polygon_region(moved_all_points_x,
                               moved_all_points_y,
                               true);
      break;
    }
    _via_reg_canvas.focus();
  }

  if ( _via_is_user_moving_region ) {
    // draw region as the user drags the mouse coursor
    if (_via_canvas_regions.length) {
      _via_redraw_reg_canvas(); // clear old intermediate rectangle
    } else {
      // first region being drawn, just clear the full region canvas
      _via_reg_ctx.clearRect(0, 0, _via_reg_canvas.width, _via_reg_canvas.height);
    }

    var move_x = (_via_current_x - _via_region_click_x);
    var move_y = (_via_current_y - _via_region_click_y);
    var attr = _via_canvas_regions[_via_user_sel_region_id].shape_attributes;

    switch (attr['name']) {
    case VIA_REGION_SHAPE.RECT:
      _via_draw_rect_region(attr['x'] + move_x,
                            attr['y'] + move_y,
                            attr['width'],
                            attr['height'],
                            true);
      break;

    case VIA_REGION_SHAPE.CIRCLE:
      _via_draw_circle_region(attr['cx'] + move_x,
                              attr['cy'] + move_y,
                              attr['r'],
                              true);
      break;

    case VIA_REGION_SHAPE.ELLIPSE:
      _via_draw_ellipse_region(attr['cx'] + move_x,
                               attr['cy'] + move_y,
                               attr['rx'],
                               attr['ry'],
                               true);
      break;

    case VIA_REGION_SHAPE.POLYLINE: // handled by polygon
    case VIA_REGION_SHAPE.POLYGON:
      var moved_all_points_x = attr['all_points_x'].slice(0);
      var moved_all_points_y = attr['all_points_y'].slice(0);
      for (var i=0; i<moved_all_points_x.length; ++i) {
        moved_all_points_x[i] += move_x;
        moved_all_points_y[i] += move_y;
      }
      _via_draw_polygon_region(moved_all_points_x,
                               moved_all_points_y,
                               true);
      break;

    case VIA_REGION_SHAPE.POINT:
      _via_draw_point_region(attr['cx'] + move_x,
                             attr['cy'] + move_y,
                             true);
      break;
    }
    _via_reg_canvas.focus();
    return;
  }

  if ( _via_is_user_drawing_polygon ) {
    _via_redraw_reg_canvas();
    var attr = _via_canvas_regions[_via_current_polygon_region_id].shape_attributes;
    var all_points_x = attr['all_points_x'];
    var all_points_y = attr['all_points_y'];
    var npts = all_points_x.length;

    var line_x = [all_points_x.slice(npts-1), _via_current_x];
    var line_y = [all_points_y.slice(npts-1), _via_current_y];
    _via_draw_polygon_region(line_x, line_y, false);
  }
});


//
// Canvas update routines
//
function _via_redraw_reg_canvas() {
  if (_via_current_image_loaded) {
    _via_reg_ctx.clearRect(0, 0, _via_reg_canvas.width, _via_reg_canvas.height);
    if ( _via_canvas_regions.length > 0 ) {
      if (_via_is_region_boundary_visible) {
        draw_all_regions();
      }

      if (_via_is_region_id_visible) {
        draw_all_region_id();
      }
    }
  }
}

function _via_clear_reg_canvas() {
  _via_reg_ctx.clearRect(0, 0, _via_reg_canvas.width, _via_reg_canvas.height);
}

function draw_all_regions() {
  for (var i=0; i < _via_canvas_regions.length; ++i) {
    var attr = _via_canvas_regions[i].shape_attributes;
    var is_selected = _via_canvas_regions[i].is_user_selected;

    switch( attr['name'] ) {
    case VIA_REGION_SHAPE.RECT:
      _via_draw_rect_region(attr['x'],
                            attr['y'],
                            attr['width'],
                            attr['height'],
                            is_selected);
      break;

    case VIA_REGION_SHAPE.CIRCLE:
      _via_draw_circle_region(attr['cx'],
                              attr['cy'],
                              attr['r'],
                              is_selected);
      break;

    case VIA_REGION_SHAPE.ELLIPSE:
      _via_draw_ellipse_region(attr['cx'],
                               attr['cy'],
                               attr['rx'],
                               attr['ry'],
                               is_selected);
      break;

    case VIA_REGION_SHAPE.POLYLINE: // handled by polygon
    case VIA_REGION_SHAPE.POLYGON:
      _via_draw_polygon_region(attr['all_points_x'],
                               attr['all_points_y'],
                               is_selected);
      break;

    case VIA_REGION_SHAPE.POINT:
      _via_draw_point_region(attr['cx'],
                             attr['cy'],
                             is_selected);
      break;
    }
  }
}

// control point for resize of region boundaries
function _via_draw_control_point(cx, cy) {
  _via_reg_ctx.beginPath();
  _via_reg_ctx.arc(cx, cy, VIA_REGION_POINT_RADIUS, 0, 2*Math.PI, false);
  _via_reg_ctx.closePath();

  _via_reg_ctx.fillStyle = VIA_THEME_CONTROL_POINT_COLOR;
  _via_reg_ctx.globalAlpha = 1.0;
  _via_reg_ctx.fill();
}

function _via_draw_rect_region(x, y, w, h, is_selected) {
  if (is_selected) {
    _via_draw_rect(x, y, w, h);

    _via_reg_ctx.strokeStyle = VIA_THEME_SEL_REGION_FILL_BOUNDARY_COLOR;
    _via_reg_ctx.lineWidth   = VIA_THEME_REGION_BOUNDARY_WIDTH/2;
    _via_reg_ctx.stroke();

    _via_reg_ctx.fillStyle   = VIA_THEME_SEL_REGION_FILL_COLOR;
    _via_reg_ctx.globalAlpha = VIA_THEME_SEL_REGION_OPACITY;
    _via_reg_ctx.fill();
    _via_reg_ctx.globalAlpha = 1.0;

    _via_draw_control_point(x  ,   y);
    _via_draw_control_point(x+w, y+h);
    _via_draw_control_point(x  , y+h);
    _via_draw_control_point(x+w,   y);
    _via_draw_control_point(x+w/2,   y);
    _via_draw_control_point(x+w/2, y+h);
    _via_draw_control_point(x    , y+h/2);
    _via_draw_control_point(x+w  , y+h/2);
  } else {
    // draw a fill line
    _via_reg_ctx.strokeStyle = VIA_THEME_BOUNDARY_FILL_COLOR;
    _via_reg_ctx.lineWidth   = VIA_THEME_REGION_BOUNDARY_WIDTH/2;
    _via_draw_rect(x, y, w, h);
    _via_reg_ctx.stroke();

    if ( w > VIA_THEME_REGION_BOUNDARY_WIDTH &&
         h > VIA_THEME_REGION_BOUNDARY_WIDTH ) {
      // draw a boundary line on both sides of the fill line
      _via_reg_ctx.strokeStyle = VIA_THEME_BOUNDARY_LINE_COLOR;
      _via_reg_ctx.lineWidth   = VIA_THEME_REGION_BOUNDARY_WIDTH/4;
      _via_draw_rect(x - VIA_THEME_REGION_BOUNDARY_WIDTH/2,
                     y - VIA_THEME_REGION_BOUNDARY_WIDTH/2,
                     w + VIA_THEME_REGION_BOUNDARY_WIDTH,
                     h + VIA_THEME_REGION_BOUNDARY_WIDTH);
      _via_reg_ctx.stroke();

      _via_draw_rect(x + VIA_THEME_REGION_BOUNDARY_WIDTH/2,
                     y + VIA_THEME_REGION_BOUNDARY_WIDTH/2,
                     w - VIA_THEME_REGION_BOUNDARY_WIDTH,
                     h - VIA_THEME_REGION_BOUNDARY_WIDTH);
      _via_reg_ctx.stroke();
    }
  }
}

function _via_draw_rect(x, y, w, h) {
  _via_reg_ctx.beginPath();
  _via_reg_ctx.moveTo(x  , y);
  _via_reg_ctx.lineTo(x+w, y);
  _via_reg_ctx.lineTo(x+w, y+h);
  _via_reg_ctx.lineTo(x  , y+h);
  _via_reg_ctx.closePath();
}

function _via_draw_circle_region(cx, cy, r, is_selected) {
  if (is_selected) {
    _via_draw_circle(cx, cy, r);

    _via_reg_ctx.strokeStyle = VIA_THEME_SEL_REGION_FILL_BOUNDARY_COLOR;
    _via_reg_ctx.lineWidth   = VIA_THEME_REGION_BOUNDARY_WIDTH/2;
    _via_reg_ctx.stroke();

    _via_reg_ctx.fillStyle   = VIA_THEME_SEL_REGION_FILL_COLOR;
    _via_reg_ctx.globalAlpha = VIA_THEME_SEL_REGION_OPACITY;
    _via_reg_ctx.fill();
    _via_reg_ctx.globalAlpha = 1.0;

    _via_draw_control_point(cx + r, cy);
  } else {
    // draw a fill line
    _via_reg_ctx.strokeStyle = VIA_THEME_BOUNDARY_FILL_COLOR;
    _via_reg_ctx.lineWidth   = VIA_THEME_REGION_BOUNDARY_WIDTH/2;
    _via_draw_circle(cx, cy, r);
    _via_reg_ctx.stroke();

    if ( r > VIA_THEME_REGION_BOUNDARY_WIDTH ) {
      // draw a boundary line on both sides of the fill line
      _via_reg_ctx.strokeStyle = VIA_THEME_BOUNDARY_LINE_COLOR;
      _via_reg_ctx.lineWidth   = VIA_THEME_REGION_BOUNDARY_WIDTH/4;
      _via_draw_circle(cx, cy,
                       r - VIA_THEME_REGION_BOUNDARY_WIDTH/2);
      _via_reg_ctx.stroke();
      _via_draw_circle(cx, cy,
                       r + VIA_THEME_REGION_BOUNDARY_WIDTH/2);
      _via_reg_ctx.stroke();
    }
  }
}

function _via_draw_circle(cx, cy, r) {
  _via_reg_ctx.beginPath();
  _via_reg_ctx.arc(cx, cy, r, 0, 2*Math.PI, false);
  _via_reg_ctx.closePath();
}

function _via_draw_ellipse_region(cx, cy, rx, ry, is_selected) {
  if (is_selected) {
    _via_draw_ellipse(cx, cy, rx, ry);

    _via_reg_ctx.strokeStyle = VIA_THEME_SEL_REGION_FILL_BOUNDARY_COLOR;
    _via_reg_ctx.lineWidth   = VIA_THEME_REGION_BOUNDARY_WIDTH/2;
    _via_reg_ctx.stroke();

    _via_reg_ctx.fillStyle   = VIA_THEME_SEL_REGION_FILL_COLOR;
    _via_reg_ctx.globalAlpha = VIA_THEME_SEL_REGION_OPACITY;
    _via_reg_ctx.fill();
    _via_reg_ctx.globalAlpha = 1.0;

    _via_draw_control_point(cx + rx, cy);
    _via_draw_control_point(cx     , cy - ry);
  } else {
    // draw a fill line
    _via_reg_ctx.strokeStyle = VIA_THEME_BOUNDARY_FILL_COLOR;
    _via_reg_ctx.lineWidth   = VIA_THEME_REGION_BOUNDARY_WIDTH/2;
    _via_draw_ellipse(cx, cy, rx, ry);
    _via_reg_ctx.stroke();

    if ( rx > VIA_THEME_REGION_BOUNDARY_WIDTH &&
         ry > VIA_THEME_REGION_BOUNDARY_WIDTH ) {
      // draw a boundary line on both sides of the fill line
      _via_reg_ctx.strokeStyle = VIA_THEME_BOUNDARY_LINE_COLOR;
      _via_reg_ctx.lineWidth   = VIA_THEME_REGION_BOUNDARY_WIDTH/4;
      _via_draw_ellipse(cx, cy,
                        rx + VIA_THEME_REGION_BOUNDARY_WIDTH/2,
                        ry + VIA_THEME_REGION_BOUNDARY_WIDTH/2);
      _via_reg_ctx.stroke();
      _via_draw_ellipse(cx, cy,
                        rx - VIA_THEME_REGION_BOUNDARY_WIDTH/2,
                        ry - VIA_THEME_REGION_BOUNDARY_WIDTH/2);
      _via_reg_ctx.stroke();
    }
  }
}

function _via_draw_ellipse(cx, cy, rx, ry) {
  _via_reg_ctx.save();

  _via_reg_ctx.beginPath();
  _via_reg_ctx.translate(cx-rx, cy-ry);
  _via_reg_ctx.scale(rx, ry);
  _via_reg_ctx.arc(1, 1, 1, 0, 2 * Math.PI, false);

  _via_reg_ctx.restore(); // restore to original state
  _via_reg_ctx.closePath();

}

function _via_draw_polygon_region(all_points_x, all_points_y, is_selected) {
  if ( is_selected ) {
    _via_reg_ctx.beginPath();
    _via_reg_ctx.moveTo(all_points_x[0], all_points_y[0]);
    for ( var i=1; i < all_points_x.length; ++i ) {
      _via_reg_ctx.lineTo(all_points_x[i], all_points_y[i]);
    }
    _via_reg_ctx.strokeStyle = VIA_THEME_SEL_REGION_FILL_BOUNDARY_COLOR;
    _via_reg_ctx.lineWidth   = VIA_THEME_REGION_BOUNDARY_WIDTH/2;
    _via_reg_ctx.stroke();

    _via_reg_ctx.fillStyle   = VIA_THEME_SEL_REGION_FILL_COLOR;
    _via_reg_ctx.globalAlpha = VIA_THEME_SEL_REGION_OPACITY;
    _via_reg_ctx.fill();
    _via_reg_ctx.globalAlpha = 1.0;

    for ( var i=0; i < all_points_x.length; ++i ) {
      _via_draw_control_point(all_points_x[i], all_points_y[i]);
    }
  } else {
    for ( var i=1; i < all_points_x.length; ++i ) {
      // draw a fill line
      _via_reg_ctx.strokeStyle = VIA_THEME_BOUNDARY_FILL_COLOR;
      _via_reg_ctx.lineWidth   = VIA_THEME_REGION_BOUNDARY_WIDTH/2;
      _via_reg_ctx.beginPath();
      _via_reg_ctx.moveTo(all_points_x[i-1], all_points_y[i-1]);
      _via_reg_ctx.lineTo(all_points_x[i]  , all_points_y[i]);
      _via_reg_ctx.stroke();

      var slope_i = (all_points_y[i] - all_points_y[i-1]) / (all_points_x[i] - all_points_x[i-1]);
      if ( slope_i > 0 ) {
        // draw a boundary line on both sides
        _via_reg_ctx.strokeStyle = VIA_THEME_BOUNDARY_LINE_COLOR;
        _via_reg_ctx.lineWidth   = VIA_THEME_REGION_BOUNDARY_WIDTH/4;
        _via_reg_ctx.beginPath();
        _via_reg_ctx.moveTo(parseInt(all_points_x[i-1]) - parseInt(VIA_THEME_REGION_BOUNDARY_WIDTH/4),
                            parseInt(all_points_y[i-1]) + parseInt(VIA_THEME_REGION_BOUNDARY_WIDTH/4));
        _via_reg_ctx.lineTo(parseInt(all_points_x[i]) - parseInt(VIA_THEME_REGION_BOUNDARY_WIDTH/4),
                            parseInt(all_points_y[i]) + parseInt(VIA_THEME_REGION_BOUNDARY_WIDTH/4));
        _via_reg_ctx.stroke();
        _via_reg_ctx.beginPath();
        _via_reg_ctx.moveTo(parseInt(all_points_x[i-1]) + parseInt(VIA_THEME_REGION_BOUNDARY_WIDTH/4),
                            parseInt(all_points_y[i-1]) - parseInt(VIA_THEME_REGION_BOUNDARY_WIDTH/4));
        _via_reg_ctx.lineTo(parseInt(all_points_x[i]) + parseInt(VIA_THEME_REGION_BOUNDARY_WIDTH/4),
                            parseInt(all_points_y[i]) - parseInt(VIA_THEME_REGION_BOUNDARY_WIDTH/4));
        _via_reg_ctx.stroke();
      } else {
        // draw a boundary line on both sides
        _via_reg_ctx.strokeStyle = VIA_THEME_BOUNDARY_LINE_COLOR;
        _via_reg_ctx.lineWidth   = VIA_THEME_REGION_BOUNDARY_WIDTH/4;
        _via_reg_ctx.beginPath();
        _via_reg_ctx.moveTo(parseInt(all_points_x[i-1]) + parseInt(VIA_THEME_REGION_BOUNDARY_WIDTH/4),
                            parseInt(all_points_y[i-1]) + parseInt(VIA_THEME_REGION_BOUNDARY_WIDTH/4));
        _via_reg_ctx.lineTo(parseInt(all_points_x[i]) + parseInt(VIA_THEME_REGION_BOUNDARY_WIDTH/4),
                            parseInt(all_points_y[i]) + parseInt(VIA_THEME_REGION_BOUNDARY_WIDTH/4));
        _via_reg_ctx.stroke();
        _via_reg_ctx.beginPath();
        _via_reg_ctx.moveTo(parseInt(all_points_x[i-1]) - parseInt(VIA_THEME_REGION_BOUNDARY_WIDTH/4),
                            parseInt(all_points_y[i-1]) - parseInt(VIA_THEME_REGION_BOUNDARY_WIDTH/4));
        _via_reg_ctx.lineTo(parseInt(all_points_x[i]) - parseInt(VIA_THEME_REGION_BOUNDARY_WIDTH/4),
                            parseInt(all_points_y[i]) - parseInt(VIA_THEME_REGION_BOUNDARY_WIDTH/4));
        _via_reg_ctx.stroke();
      }
    }
  }
}

function _via_draw_point_region(cx, cy, is_selected) {
  if (is_selected) {
    _via_draw_point(cx, cy, VIA_REGION_POINT_RADIUS);

    _via_reg_ctx.strokeStyle = VIA_THEME_SEL_REGION_FILL_BOUNDARY_COLOR;
    _via_reg_ctx.lineWidth   = VIA_THEME_REGION_BOUNDARY_WIDTH/2;
    _via_reg_ctx.stroke();

    _via_reg_ctx.fillStyle   = VIA_THEME_SEL_REGION_FILL_COLOR;
    _via_reg_ctx.globalAlpha = VIA_THEME_SEL_REGION_OPACITY;
    _via_reg_ctx.fill();
    _via_reg_ctx.globalAlpha = 1.0;
  } else {
    // draw a fill line
    _via_reg_ctx.strokeStyle = VIA_THEME_BOUNDARY_FILL_COLOR;
    _via_reg_ctx.lineWidth   = VIA_THEME_REGION_BOUNDARY_WIDTH/2;
    _via_draw_point(cx, cy, VIA_REGION_POINT_RADIUS);
    _via_reg_ctx.stroke();

    // draw a boundary line on both sides of the fill line
    _via_reg_ctx.strokeStyle = VIA_THEME_BOUNDARY_LINE_COLOR;
    _via_reg_ctx.lineWidth   = VIA_THEME_REGION_BOUNDARY_WIDTH/4;
    _via_draw_point(cx, cy,
                    VIA_REGION_POINT_RADIUS - VIA_THEME_REGION_BOUNDARY_WIDTH/2);
    _via_reg_ctx.stroke();
    _via_draw_point(cx, cy,
                    VIA_REGION_POINT_RADIUS + VIA_THEME_REGION_BOUNDARY_WIDTH/2);
    _via_reg_ctx.stroke();
  }
}

function _via_draw_point(cx, cy, r) {
  _via_reg_ctx.beginPath();
  _via_reg_ctx.arc(cx, cy, r, 0, 2*Math.PI, false);
  _via_reg_ctx.closePath();
}

function draw_all_region_id() {
  _via_reg_ctx.shadowColor = "transparent";
  for ( var i = 0; i < _via_img_metadata[_via_image_id].regions.length; ++i ) {
    var canvas_reg = _via_canvas_regions[i];

    var bbox = get_region_bounding_box(canvas_reg);
    var x = bbox[0];
    var y = bbox[1];
    var w = Math.abs(bbox[2] - bbox[0]);
    _via_reg_ctx.font = VIA_THEME_ATTRIBUTE_VALUE_FONT;

    var annotation_str  = (i+1).toString();
    var bgnd_rect_width = _via_reg_ctx.measureText(annotation_str).width * 2;

    var char_width  = _via_reg_ctx.measureText('M').width;
    var char_height = 1.8 * char_width;

    var r = _via_img_metadata[_via_image_id].regions[i].region_attributes;
    if ( Object.keys(r).length === 1 && w > (2*char_width) ) {
      // show the attribute value
      for (var key in r) {
        annotation_str = r[key];
      }
      var strw = _via_reg_ctx.measureText(annotation_str).width;

      if ( strw > w ) {
        // if text overflows, crop it
        var str_max     = Math.floor((w * annotation_str.length) / strw);
        annotation_str  = annotation_str.substr(0, str_max-1) + '.';
        bgnd_rect_width = w;
      } else {
        bgnd_rect_width = strw + char_width;
      }
    }

    if (canvas_reg.shape_attributes['name'] === VIA_REGION_SHAPE.POLYGON ||
        canvas_reg.shape_attributes['name'] === VIA_REGION_SHAPE.POLYLINE) {
      // put label near the first vertex
      x = canvas_reg.shape_attributes['all_points_x'][0];
      y = canvas_reg.shape_attributes['all_points_y'][0];
    } else {
      // center the label
      x = x - (bgnd_rect_width/2 - w/2);
    }

    // first, draw a background rectangle first
    _via_reg_ctx.fillStyle = 'black';
    _via_reg_ctx.globalAlpha = 0.8;
    _via_reg_ctx.fillRect(Math.floor(x),
                          Math.floor(y - 1.1*char_height),
                          Math.floor(bgnd_rect_width),
                          Math.floor(char_height));

    // then, draw text over this background rectangle
    _via_reg_ctx.globalAlpha = 1.0;
    _via_reg_ctx.fillStyle = 'yellow';
    _via_reg_ctx.fillText(annotation_str,
                          Math.floor(x + 0.4*char_width),
                          Math.floor(y - 0.35*char_height));

  }
}

function get_region_bounding_box(region) {
  var d = region.shape_attributes;
  var bbox = new Array(4);

  switch( d['name'] ) {
  case 'rect':
    bbox[0] = d['x'];
    bbox[1] = d['y'];
    bbox[2] = d['x'] + d['width'];
    bbox[3] = d['y'] + d['height'];
    break;

  case 'circle':
    bbox[0] = d['cx'] - d['r'];
    bbox[1] = d['cy'] - d['r'];
    bbox[2] = d['cx'] + d['r'];
    bbox[3] = d['cy'] + d['r'];
    break;

  case 'ellipse':
    bbox[0] = d['cx'] - d['rx'];
    bbox[1] = d['cy'] - d['ry'];
    bbox[2] = d['cx'] + d['rx'];
    bbox[3] = d['cy'] + d['ry'];
    break;

  case 'polyline': // handled by polygon
  case 'polygon':
    var all_points_x = d['all_points_x'];
    var all_points_y = d['all_points_y'];

    var minx = Number.MAX_SAFE_INTEGER;
    var miny = Number.MAX_SAFE_INTEGER;
    var maxx = 0;
    var maxy = 0;
    for ( var i=0; i < all_points_x.length; ++i ) {
      if ( all_points_x[i] < minx ) {
        minx = all_points_x[i];
      }
      if ( all_points_x[i] > maxx ) {
        maxx = all_points_x[i];
      }
      if ( all_points_y[i] < miny ) {
        miny = all_points_y[i];
      }
      if ( all_points_y[i] > maxy ) {
        maxy = all_points_y[i];
      }
    }
    bbox[0] = minx;
    bbox[1] = miny;
    bbox[2] = maxx;
    bbox[3] = maxy;
    break;

  case 'point':
    bbox[0] = d['cx'] - VIA_REGION_POINT_RADIUS;
    bbox[1] = d['cy'] - VIA_REGION_POINT_RADIUS;
    bbox[2] = d['cx'] + VIA_REGION_POINT_RADIUS;
    bbox[3] = d['cy'] + VIA_REGION_POINT_RADIUS;
    break;
  }
  return bbox;
}

//
// Region collision routines
//
function is_inside_region(px, py, descending_order) {
  var N = _via_canvas_regions.length;
  if ( N === 0 ) {
    return -1;
  }
  var start, end, del;
  // traverse the canvas regions in alternating ascending
  // and descending order to solve the issue of nested regions
  if ( descending_order ) {
    start = N - 1;
    end   = -1;
    del   = -1;
  } else {
    start = 0;
    end   = N;
    del   = 1;
  }

  var i = start;
  while ( i !== end ) {
    var yes = is_inside_this_region(px, py, i);
    if (yes) {
      return i;
    }
    i = i + del;
  }
  return -1;
}

function is_inside_this_region(px, py, region_id) {
  var attr   = _via_canvas_regions[region_id].shape_attributes;
  var result = false;
  switch ( attr['name'] ) {
  case VIA_REGION_SHAPE.RECT:
    result = is_inside_rect(attr['x'],
                            attr['y'],
                            attr['width'],
                            attr['height'],
                            px, py);
    break;

  case VIA_REGION_SHAPE.CIRCLE:
    result = is_inside_circle(attr['cx'],
                              attr['cy'],
                              attr['r'],
                              px, py);
    break;

  case VIA_REGION_SHAPE.ELLIPSE:
    result = is_inside_ellipse(attr['cx'],
                               attr['cy'],
                               attr['rx'],
                               attr['ry'],
                               px, py);
    break;

  case VIA_REGION_SHAPE.POLYLINE: // handled by POLYGON
  case VIA_REGION_SHAPE.POLYGON:
    result = is_inside_polygon(attr['all_points_x'],
                               attr['all_points_y'],
                               px, py);
    break;

  case VIA_REGION_SHAPE.POINT:
    result = is_inside_point(attr['cx'],
                             attr['cy'],
                             px, py);
    break;
  }
  return result;
}

function is_inside_circle(cx, cy, r, px, py) {
  var dx = px - cx;
  var dy = py - cy;
  return (dx * dx + dy * dy) < r * r;
}

function is_inside_rect(x, y, w, h, px, py) {
  return px > x &&
    px < (x + w) &&
    py > y &&
    py < (y + h);
}

function is_inside_ellipse(cx, cy, rx, ry, px, py) {
  var dx = (cx - px);
  var dy = (cy - py);
  return ((dx * dx) / (rx * rx)) + ((dy * dy) / (ry * ry)) < 1;
}

// returns 0 when (px,py) is outside the polygon
// source: http://geomalgorithms.com/a03-_inclusion.html
function is_inside_polygon(all_points_x, all_points_y, px, py) {
  var wn = 0;    // the  winding number counter

  // loop through all edges of the polygon
  for ( var i = 0; i < all_points_x.length-1; ++i ) {   // edge from V[i] to  V[i+1]
    var is_left_value = is_left( all_points_x[i], all_points_y[i],
                                 all_points_x[i+1], all_points_y[i+1],
                                 px, py);

    if (all_points_y[i] <= py) {
      if (all_points_y[i+1]  > py && is_left_value > 0) {
        ++wn;
      }
    }
    else {
      if (all_points_y[i+1]  <= py && is_left_value < 0) {
        --wn;
      }
    }
  }
  if ( wn === 0 ) {
    return 0;
  }
  else {
    return 1;
  }
}

function is_inside_point(cx, cy, px, py) {
  var dx = px - cx;
  var dy = py - cy;
  var r2 = VIA_POLYGON_VERTEX_MATCH_TOL * VIA_POLYGON_VERTEX_MATCH_TOL;
  return (dx * dx + dy * dy) < r2;
}

// returns
// >0 if (x2,y2) lies on the left side of line joining (x0,y0) and (x1,y1)
// =0 if (x2,y2) lies on the line joining (x0,y0) and (x1,y1)
// >0 if (x2,y2) lies on the right side of line joining (x0,y0) and (x1,y1)
// source: http://geomalgorithms.com/a03-_inclusion.html
function is_left(x0, y0, x1, y1, x2, y2) {
  return ( ((x1 - x0) * (y2 - y0))  - ((x2 -  x0) * (y1 - y0)) );
}

function is_on_region_corner(px, py) {
  var _via_region_edge = [-1, -1]; // region_id, corner_id [top-left=1,top-right=2,bottom-right=3,bottom-left=4]

  for ( var i = 0; i < _via_canvas_regions.length; ++i ) {
    var attr = _via_canvas_regions[i].shape_attributes;
    var result = false;
    _via_region_edge[0] = i;

    switch ( attr['name'] ) {
    case VIA_REGION_SHAPE.RECT:
      result = is_on_rect_edge(attr['x'],
                               attr['y'],
                               attr['width'],
                               attr['height'],
                               px, py);
      break;

    case VIA_REGION_SHAPE.CIRCLE:
      result = is_on_circle_edge(attr['cx'],
                                 attr['cy'],
                                 attr['r'],
                                 px, py);
      break;

    case VIA_REGION_SHAPE.ELLIPSE:
      result = is_on_ellipse_edge(attr['cx'],
                                  attr['cy'],
                                  attr['rx'],
                                  attr['ry'],
                                  px, py);
      break;

    case VIA_REGION_SHAPE.POLYLINE: // handled by polygon
    case VIA_REGION_SHAPE.POLYGON:
      result = is_on_polygon_vertex(attr['all_points_x'],
                                    attr['all_points_y'],
                                    px, py);
      break;

    case VIA_REGION_SHAPE.POINT:
      // since there are no edges of a point
      result = 0;
      break;
    }

    if (result > 0) {
      _via_region_edge[1] = result;
      return _via_region_edge;
    }
  }
  _via_region_edge[0] = -1;
  return _via_region_edge;
}

function is_on_rect_edge(x, y, w, h, px, py) {
  var dx0 = Math.abs(x - px);
  var dy0 = Math.abs(y - py);
  var dx1 = Math.abs(x + w - px);
  var dy1 = Math.abs(y + h - py);
  //[top-left=1,top-right=2,bottom-right=3,bottom-left=4]
  if ( dx0 < VIA_REGION_EDGE_TOL &&
       dy0 < VIA_REGION_EDGE_TOL ) {
    return 1;
  }
  if ( dx1 < VIA_REGION_EDGE_TOL &&
       dy0 < VIA_REGION_EDGE_TOL ) {
    return 2;
  }
  if ( dx1 < VIA_REGION_EDGE_TOL &&
       dy1 < VIA_REGION_EDGE_TOL ) {
    return 3;
  }

  if ( dx0 < VIA_REGION_EDGE_TOL &&
       dy1 < VIA_REGION_EDGE_TOL ) {
    return 4;
  }

  var mx0 = Math.abs(x + w/2 - px);
  var my0 = Math.abs(y + h/2 - py);
  //[top-middle=5,right-middle=6,bottom-middle=7,left-middle=8]
  if ( mx0 < VIA_REGION_EDGE_TOL &&
       dy0 < VIA_REGION_EDGE_TOL ) {
    return 5;
  }
  if ( dx1 < VIA_REGION_EDGE_TOL &&
       my0 < VIA_REGION_EDGE_TOL ) {
    return 6;
  }
  if ( mx0 < VIA_REGION_EDGE_TOL &&
       dy1 < VIA_REGION_EDGE_TOL ) {
    return 7;
  }
  if ( dx0 < VIA_REGION_EDGE_TOL &&
       my0 < VIA_REGION_EDGE_TOL ) {
    return 8;
  }

  return 0;
}

function is_on_circle_edge(cx, cy, r, px, py) {
  var dx = cx - px;
  var dy = cy - py;
  if ( Math.abs(Math.sqrt( dx*dx + dy*dy ) - r) < VIA_REGION_EDGE_TOL ) {
    var theta = Math.atan2( py - cy, px - cx );
    if ( Math.abs(theta - (Math.PI/2)) < VIA_THETA_TOL ||
         Math.abs(theta + (Math.PI/2)) < VIA_THETA_TOL) {
      return 5;
    }
    if ( Math.abs(theta) < VIA_THETA_TOL ||
         Math.abs(Math.abs(theta) - Math.PI) < VIA_THETA_TOL) {
      return 6;
    }

    if ( theta > 0 && theta < (Math.PI/2) ) {
      return 1;
    }
    if ( theta > (Math.PI/2) && theta < (Math.PI) ) {
      return 4;
    }
    if ( theta < 0 && theta > -(Math.PI/2) ) {
      return 2;
    }
    if ( theta < -(Math.PI/2) && theta > -Math.PI ) {
      return 3;
    }
  } else {
    return 0;
  }
}

function is_on_ellipse_edge(cx, cy, rx, ry, px, py) {
  var dx = (cx - px)/rx;
  var dy = (cy - py)/ry;

  if ( Math.abs(Math.sqrt( dx*dx + dy*dy ) - 1) < VIA_ELLIPSE_EDGE_TOL ) {
    var theta = Math.atan2( py - cy, px - cx );
    if ( Math.abs(theta - (Math.PI/2)) < VIA_THETA_TOL ||
         Math.abs(theta + (Math.PI/2)) < VIA_THETA_TOL) {
      return 5;
    }
    if ( Math.abs(theta) < VIA_THETA_TOL ||
         Math.abs(Math.abs(theta) - Math.PI) < VIA_THETA_TOL) {
      return 6;
    }
  } else {
    return 0;
  }
}

function is_on_polygon_vertex(all_points_x, all_points_y, px, py) {
  var n = all_points_x.length;
  for (var i=0; i<n; ++i) {
    if ( Math.abs(all_points_x[i] - px) < VIA_POLYGON_VERTEX_MATCH_TOL &&
         Math.abs(all_points_y[i] - py) < VIA_POLYGON_VERTEX_MATCH_TOL ) {
      return (VIA_POLYGON_RESIZE_VERTEX_OFFSET+i);
    }
  }
  return 0;
}

function rect_standardize_coordinates(d) {
  // d[x0,y0,x1,y1]
  // ensures that (d[0],d[1]) is top-left corner while
  // (d[2],d[3]) is bottom-right corner
  if ( d[0] > d[2] ) {
    // swap
    var t = d[0];
    d[0] = d[2];
    d[2] = t;
  }

  if ( d[1] > d[3] ) {
    // swap
    var t = d[1];
    d[1] = d[3];
    d[3] = t;
  }
}

function rect_update_corner(corner_id, d, x, y, preserve_aspect_ratio) {
  // pre-condition : d[x0,y0,x1,y1] is standardized
  // post-condition : corner is moved ( d may not stay standardized )
  if (preserve_aspect_ratio) {
    switch(corner_id) {
    case 1: // Fall-through // top-left
    case 3: // bottom-right
      var dx = d[2] - d[0];
      var dy = d[3] - d[1];
      var norm = Math.sqrt( dx*dx + dy*dy );
      var nx = dx / norm; // x component of unit vector along the diagonal of rect
      var ny = dy / norm; // y component
      var proj = (x - d[0]) * nx + (y - d[1]) * ny;
      var proj_x = nx * proj;
      var proj_y = ny * proj;
      // constrain (mx,my) to lie on a line connecting (x0,y0) and (x1,y1)
      x = Math.round( d[0] + proj_x );
      y = Math.round( d[1] + proj_y );
      break;

    case 2: // Fall-through // top-right
    case 4: // bottom-left
      var dx = d[2] - d[0];
      var dy = d[1] - d[3];
      var norm = Math.sqrt( dx*dx + dy*dy );
      var nx = dx / norm; // x component of unit vector along the diagonal of rect
      var ny = dy / norm; // y component
      var proj = (x - d[0]) * nx + (y - d[3]) * ny;
      var proj_x = nx * proj;
      var proj_y = ny * proj;
      // constrain (mx,my) to lie on a line connecting (x0,y0) and (x1,y1)
      x = Math.round( d[0] + proj_x );
      y = Math.round( d[3] + proj_y );
      break;
    }
  }

  switch(corner_id) {
  case 1: // top-left
    d[0] = x;
    d[1] = y;
    break;

  case 3: // bottom-right
    d[2] = x;
    d[3] = y;
    break;

  case 2: // top-right
    d[2] = x;
    d[1] = y;
    break;

  case 4: // bottom-left
    d[0] = x;
    d[3] = y;
    break;

  case 5: // top-middle
    d[1] = y;
    break;

  case 6: // right-middle
    d[2] = x;
    break;

  case 7: // bottom-middle
    d[3] = y;
    break;

  case 8: // left-middle
    d[0] = x;
    break;
  }
}

function _via_update_ui_components() {
  if ( !_via_is_window_resized && _via_current_image_loaded ) {
    /////
    ///// @todo
    ///// handle all the cases
    /////
    console.log('@TODO');
    _via_is_window_resized = true;
    show_image(_via_image_index);

    if (_via_is_canvas_zoomed) {
      reset_zoom_level();
    }
    show_message('Browser window resized. Updated user interface components.');
  }
}

//
// Shortcut key handlers
//

_via_reg_canvas.addEventListener('keyup', function(e) {
  if (_via_is_user_updating_attribute_value ||
      _via_is_user_updating_attribute_name  ||
      _via_is_user_adding_attribute_name) {

    return;
  }

  if ( e.which === 17 ) { // Ctrl key
    _via_is_ctrl_pressed = false;
  }
});

_via_reg_canvas.addEventListener('keydown', function(e) {
  if (_via_is_user_updating_attribute_value ||
      _via_is_user_updating_attribute_name  ||
      _via_is_user_adding_attribute_name) {

    return;
  }

  // user commands
  if ( e.ctrlKey ) {
    _via_is_ctrl_pressed = true;
    if ( e.which === 83 ) { // Ctrl + s
      download_all_region_data('csv');
      e.preventDefault();
      return;
    }

    if ( e.which === 65 ) { // Ctrl + a
      sel_all_regions();
      e.preventDefault();
      return;
    }

    if ( e.which === 67 ) { // Ctrl + c
      if (_via_is_region_selected ||
          _via_is_all_region_selected) {
        copy_sel_regions();
        e.preventDefault();
      }
      return;
    }

    if ( e.which === 86 ) { // Ctrl + v
      paste_sel_regions_in_current_image();
      e.preventDefault();
      return;
    }
  }

  if( e.which === 46 || e.which === 8) { // Del or Backspace
    del_sel_regions();
    e.preventDefault();
  }
  if (e.which === 78 || e.which === 39) { // n or right arrow
    move_to_next_image();
    e.preventDefault();
    return;
  }
  if (e.which === 80 || e.which === 37) { // n or right arrow
    move_to_prev_image();
    e.preventDefault();
    return;
  }
  if (e.which === 32 && _via_current_image_loaded) { // Space
    toggle_img_list();
    e.preventDefault();
    return;
  }

  if ( e.which === 83 ) { // s key
    project_save_with_confirm();
    return;
  }
  if ( e.which === 79 ) { // o key
    project_open_select_project_file();
    return;
  }

  // zoom
  if (_via_current_image_loaded) {
    // see: http://www.javascripter.net/faq/keycodes.htm
    if (e.which === 61 || e.which === 187) { // + for zoom in
      if (e.shiftKey) {
        zoom_in();
      } else {  // = for zoom reset
        reset_zoom_level();
      }
      return;
    }

    if (e.which === 173 || e.which === 189) { // - for zoom out
      zoom_out();
      return;
    }
  }

  if ( e.which === 27 ) { // Esc
    if (_via_is_user_updating_attribute_value ||
        _via_is_user_updating_attribute_name ||
        _via_is_user_adding_attribute_name) {

      _via_is_user_updating_attribute_value = false;
      _via_is_user_updating_attribute_name = false;
      _via_is_user_adding_attribute_name = false;
      update_annotation_editor();
    }

    if ( _via_is_user_resizing_region ) {
      // cancel region resizing action
      _via_is_user_resizing_region = false;
    }

    if ( _via_is_region_selected ) {
      // clear all region selections
      _via_is_region_selected = false;
      _via_user_sel_region_id = -1;
      toggle_all_regions_selection(false);
    }

    if ( _via_is_user_drawing_polygon ) {
      _via_is_user_drawing_polygon = false;
      _via_canvas_regions.splice(_via_current_polygon_region_id, 1);
    }

    if ( _via_is_user_drawing_region ) {
      _via_is_user_drawing_region = false;
    }

    if ( _via_is_user_resizing_region ) {
      _via_is_user_resizing_region = false
    }

    if ( _via_is_user_updating_attribute_name ||
         _via_is_user_updating_attribute_value) {
      _via_is_user_updating_attribute_name = false;
      _via_is_user_updating_attribute_value = false;

    }

    if ( _via_is_user_moving_region ) {
      _via_is_user_moving_region = false
    }

    _via_redraw_reg_canvas();
    _via_reg_canvas.focus();
    e.preventDefault();
    return;
  }

  if (e.which === 112) { // F1 for help
    show_getting_started_panel();
    e.preventDefault();
    return;
  }
  if (e.which === 113) { // F2 for about
    show_about_panel();
    e.preventDefault();
    return;
  }
  if ( e.which === 13 ) { // Enter key
    if ( _via_current_shape === VIA_REGION_SHAPE.POLYLINE ||
         _via_current_shape === VIA_REGION_SHAPE.POLYGON) {
      // [Enter] key is used to indicate completion of
      // polygon or polyline drawing action

      var npts =  _via_canvas_regions[_via_current_polygon_region_id].shape_attributes['all_points_x'].length;
      if ( npts <=2 && _via_current_shape === VIA_REGION_SHAPE.POLYGON ) {
        show_message('For a polygon, you must define at least 3 points. ' +
                     'Press [Esc] to cancel drawing operation.!');
        return;
      }
      if ( npts <=1 && _via_current_shape === VIA_REGION_SHAPE.POLYLINE ) {
        show_message('A polyline must have at least 2 points. ' +
                     'Press [Esc] to cancel drawing operation.!');
        return;
      }

      _via_is_user_drawing_polygon = false;
      add_new_polygon();

      // newly drawn region is automatically selected
      select_only_region(_via_current_polygon_region_id);
      set_region_annotations_to_default_value( _via_current_polygon_region_id );
      annotation_editor_add_row( _via_current_polygon_region_id );
      annotation_editor_scroll_to_row( _via_current_polygon_region_id );
      _via_current_polygon_region_id = -1;

      save_current_data_to_browser_cache();
      _via_redraw_reg_canvas();
      _via_reg_canvas.focus();
    }
  }
});

function add_new_polygon() {
  // add all polygon points stored in _via_canvas_regions[]
  var all_points_x = _via_canvas_regions[_via_current_polygon_region_id].shape_attributes['all_points_x'].slice(0);
  var all_points_y = _via_canvas_regions[_via_current_polygon_region_id].shape_attributes['all_points_y'].slice(0);

  if ( _via_current_shape === VIA_REGION_SHAPE.POLYGON ) {
    // close path of the polygon (the user need not connect the final vertex)
    // hence all polygons will have at least 4 points
    all_points_x.push(all_points_x[0]);
    all_points_y.push(all_points_y[0]);
  }

  var canvas_all_points_x = [];
  var canvas_all_points_y = [];

  //var points_str = '';
  for ( var i=0; i<all_points_x.length; ++i ) {
    all_points_x[i] = Math.round( all_points_x[i] * _via_canvas_scale );
    all_points_y[i] = Math.round( all_points_y[i] * _via_canvas_scale );

    canvas_all_points_x[i] = Math.round( all_points_x[i] / _via_canvas_scale );
    canvas_all_points_y[i] = Math.round( all_points_y[i] / _via_canvas_scale );
  }

  var polygon_region = new ImageRegion();
  polygon_region.shape_attributes['name'] = _via_current_shape;
  polygon_region.shape_attributes['all_points_x'] = all_points_x;
  polygon_region.shape_attributes['all_points_y'] = all_points_y;
  _via_current_polygon_region_id = _via_img_metadata[_via_image_id].regions.length;
  _via_img_metadata[_via_image_id].regions.push(polygon_region);

  // update canvas
  _via_canvas_regions[_via_current_polygon_region_id].shape_attributes['name'] = _via_current_shape;
  _via_canvas_regions[_via_current_polygon_region_id].shape_attributes['all_points_x'] = canvas_all_points_x;
  _via_canvas_regions[_via_current_polygon_region_id].shape_attributes['all_points_y'] = canvas_all_points_y;
}

function del_sel_regions() {
  if ( !_via_current_image_loaded ) {
    show_message('First load some images!');
    return;
  }

  var del_region_count = 0;
  if ( _via_is_all_region_selected ) {
    del_region_count = _via_canvas_regions.length;
    _via_canvas_regions.splice(0);
    _via_img_metadata[_via_image_id].regions.splice(0);
  } else {
    var sorted_sel_reg_id = [];
    for ( var i = 0; i < _via_canvas_regions.length; ++i ) {
      if ( _via_canvas_regions[i].is_user_selected ) {
        sorted_sel_reg_id.push(i);
      }
    }
    sorted_sel_reg_id.sort( function(a,b) {
      return (b-a);
    });
    for ( var i = 0; i < sorted_sel_reg_id.length; ++i ) {
      _via_canvas_regions.splice( sorted_sel_reg_id[i], 1);
      _via_img_metadata[_via_image_id].regions.splice( sorted_sel_reg_id[i], 1);
      del_region_count += 1;
    }
  }

  _via_is_all_region_selected = false;
  _via_is_region_selected     = false;
  _via_user_sel_region_id     = -1;

  if ( _via_canvas_regions.length === 0 ) {
    // all regions were deleted, hence clear region canvas
    _via_clear_reg_canvas();
  } else {
    _via_redraw_reg_canvas();
  }
  _via_reg_canvas.focus();
  update_annotation_editor();
  save_current_data_to_browser_cache();

  show_message('Deleted ' + del_region_count + ' selected regions');
}

function sel_all_regions() {
  if (!_via_current_image_loaded) {
    show_message('First load some images!');
    return;
  }

  toggle_all_regions_selection(true);
  _via_is_all_region_selected = true;
  _via_redraw_reg_canvas();
}

function copy_sel_regions() {
  if (!_via_current_image_loaded) {
    show_message('First load some images!');
    return;
  }

  if (_via_is_region_selected ||
      _via_is_all_region_selected) {
    _via_copied_image_regions.splice(0);
    for ( var i = 0; i < _via_img_metadata[_via_image_id].regions.length; ++i ) {
      var img_region = _via_img_metadata[_via_image_id].regions[i];
      var canvas_region = _via_canvas_regions[i];
      if ( canvas_region.is_user_selected ) {
        _via_copied_image_regions.push( clone_image_region(img_region) );
      }
    }
    show_message('Copied ' + _via_copied_image_regions.length +
                 ' selected regions. Press Ctrl + v to paste');
  } else {
    show_message('Select a region first!');
  }
}

function paste_sel_regions_in_current_image() {
  if ( !_via_current_image_loaded ) {
    show_message('First load some images!');
    return;
  }

  if ( _via_copied_image_regions.length ) {
    var pasted_reg_count = 0;
    for ( var i = 0; i < _via_copied_image_regions.length; ++i ) {
      // ensure copied the regions are within this image's boundaries
      var bbox = get_region_bounding_box( _via_copied_image_regions[i] );
      if (bbox[2] < _via_current_image_width &&
          bbox[3] < _via_current_image_height) {
        var r = clone_image_region(_via_copied_image_regions[i]);
        _via_img_metadata[_via_image_id].regions.push(r);

        pasted_reg_count += 1;
      }
    }
    _via_load_canvas_regions();
    var discarded_reg_count = _via_copied_image_regions.length - pasted_reg_count;
    show_message('Pasted ' + pasted_reg_count + ' regions. ' +
                 'Discarded ' + discarded_reg_count + ' regions exceeding image boundary.');
    _via_redraw_reg_canvas();
    _via_reg_canvas.focus();
  } else {
    show_message('To paste a region, you first need to select a region and copy it!');
  }
}

function paste_to_multiple_images_with_confirm() {
  if ( _via_copied_image_regions.length === 0 ) {
    show_message('First copy some regions!');
    return;
  }

  var config = {'title':'Paste Regions to Multiple Images' };
  var input = { 'region_count': { type:'text', name:'Number of copied regions', value:_via_copied_image_regions.length, disabled:true },
                'prev_next_count':{ type:'text', name:'Copy to (count format)<br><span style="font-size:0.8rem">For example: to paste copied regions to the <i>previous 2 images</i> and <i>next 3 images</i>, type <strong>2,3</strong> in the textbox and to paste only in <i>next 5 images</i>, type <strong>0,5</strong></span>', placeholder:'2,3', disabled:false, size:30},
                'img_index_list':{ type:'text', name:'Copy to (image index list)<br><span style="font-size:0.8rem">For example: <strong>2-5,7,9</strong> pastes the copied regions to the images with the following id <i>2,3,4,5,7,9</i> and <strong>3,8,141</strong> pastes to the images with id <i>3,8 and 141</i></span>', placeholder:'2-5,7,9', disabled:false, size:30},
                'regex':{ type:'text', name:'Copy to filenames matching a regular expression<br><span style="font-size:0.8rem">For example: <strong>_large</strong> pastes the copied regions to all images whose filename contain the keyword <i>_large</i></span>', placeholder:'regular expression', disabled:false, size:30},
                'include_region_attributes':{ type:'checkbox', name:'Paste also the region annotations', checked:true},
              };

  invoke_with_user_inputs(paste_to_multiple_images_confirmed, input, config);
}

function paste_to_multiple_images_confirmed(input) {
  // keep a copy of user inputs for the undo operation
  _via_paste_to_multiple_images_input = input;

  user_input_default_cancel_handler();
  var intersect = generate_img_index_list(input);
  var i;
  var total_pasted_region_count = 0;
  for ( i = 0; i < intersect.length; i++ ) {
    total_pasted_region_count += paste_regions( intersect[i] );
  }

  show_message('Pasted [' + total_pasted_region_count + '] regions ' +
               'in ' + intersect.length + ' images');

  if ( intersect.includes(_via_image_index) ) {
    _via_load_canvas_regions();
    _via_redraw_reg_canvas();
    _via_reg_canvas.focus();
  }
}


function paste_regions(img_index) {
  var pasted_reg_count = 0;
  if ( _via_copied_image_regions.length ) {
    var img_id = _via_image_id_list[img_index];
    var i;
    for ( i = 0; i < _via_copied_image_regions.length; ++i ) {
      var r = clone_image_region(_via_copied_image_regions[i]);
      _via_img_metadata[img_id].regions.push(r);

      pasted_reg_count += 1;
    }
  }
  return pasted_reg_count;
}


function del_sel_regions_with_confirm() {
  if ( _via_copied_image_regions.length === 0 ) {
    show_message('First copy some regions!');
    return;
  }

  var prev_next_count, img_index_list, regex;
  if ( _via_paste_to_multiple_images_input ) {
    prev_next_count = _via_paste_to_multiple_images_input.prev_next_count.value;
    img_index_list  = _via_paste_to_multiple_images_input.img_index_list.value;
    regex = _via_paste_to_multiple_images_input.regex.value;
  }

  var config = {'title':'Undo Regions Pasted to Multiple Images' };
  var input = { 'region_count': { type:'text', name:'Number of regions selected', value:_via_copied_image_regions.length, disabled:true },
                'prev_next_count':{ type:'text', name:'Delete from (count format)<br><span style="font-size:0.8rem">For example: to delete copied regions from the <i>previous 2 images</i> and <i>next 3 images</i>, type <strong>2,3</strong> in the textbox and to delete regions only in <i>next 5 images</i>, type <strong>0,5</strong></span>', placeholder:'2,3', disabled:false, size:30, value:prev_next_count},
                'img_index_list':{ type:'text', name:'Delete from (image index list)<br><span style="font-size:0.8rem">For example: <strong>2-5,7,9</strong> deletes the copied regions to the images with the following id <i>2,3,4,5,7,9</i> and <strong>3,8,141</strong> deletes regions from the images with id <i>3,8 and 141</i></span>', placeholder:'2-5,7,9', disabled:false, size:30, value:img_index_list},
                'regex':{ type:'text', name:'Delete from filenames matching a regular expression<br><span style="font-size:0.8rem">For example: <strong>_large</strong> deletes the copied regions from all images whose filename contain the keyword <i>_large</i></span>', placeholder:'regular expression', disabled:false, size:30, value:regex},
              };

  invoke_with_user_inputs(del_sel_regions_confirmed, input, config);
}

function del_sel_regions_confirmed(input) {
  user_input_default_cancel_handler();
  var intersect = generate_img_index_list(input);
  var i;
  var total_deleted_region_count = 0;
  for ( i = 0; i < intersect.length; i++ ) {
    total_deleted_region_count += delete_regions( intersect[i] );
  }

  show_message('Deleted [' + total_deleted_region_count + '] regions ' +
               'in ' + intersect.length + ' images');

  if ( intersect.includes(_via_image_index) ) {
    _via_load_canvas_regions();
    _via_redraw_reg_canvas();
    _via_reg_canvas.focus();
  }
}

function delete_regions(img_index) {
  var del_region_count = 0;
  if ( _via_copied_image_regions.length ) {
    var img_id = _via_image_id_list[img_index];
    var i;
    for ( i = 0; i < _via_copied_image_regions.length; ++i ) {
      var copied_region_shape_str = JSON.stringify(_via_copied_image_regions[i].shape_attributes);
      var j;
      // start from last region in order to delete the last pasted region
      for ( j = _via_img_metadata[img_id].regions.length-1; j >= 0; --j ) {
        if ( JSON.stringify(_via_img_metadata[img_id].regions[j].shape_attributes) === copied_region_shape_str ) {
          _via_img_metadata[img_id].regions.splice( j, 1);
          del_region_count += 1;
          break; // delete only one matching region
        }
      }
    }
  }
  return del_region_count;
}

function move_to_prev_image() {
  if (_via_img_count > 0) {
    _via_is_region_selected = false;
    _via_user_sel_region_id = -1;

    var current_img_index = _via_image_index;
    if ( _via_loaded_img_fn_list_file_index.includes( current_img_index ) ) {
      var list_index = _via_loaded_img_fn_list_file_index.indexOf( current_img_index );
      var next_list_index = list_index - 1;
      if ( next_list_index === -1 ) {
        next_list_index = _via_loaded_img_fn_list_file_index.length - 1;
      }
      var next_img_index = _via_loaded_img_fn_list_file_index[next_list_index];
      show_image(next_img_index);
    } else {
      if ( _via_loaded_img_fn_list_file_index.length === 0 ) {
        show_message('Filtered file list does not any files!');
      } else {
        show_image( _via_loaded_img_fn_list_file_index[0] );
      }
    }

    if (typeof _via_hook_prev_image === 'function') {
      _via_hook_prev_image(current_img_index);
    }
  }
}

function move_to_next_image() {
  if (_via_img_count > 0) {
    _via_is_region_selected = false;
    _via_user_sel_region_id = -1;

    var current_img_index = _via_image_index;
    if ( _via_loaded_img_fn_list_file_index.includes( current_img_index ) ) {
      var list_index = _via_loaded_img_fn_list_file_index.indexOf( current_img_index );
      var next_list_index = list_index + 1;
      if ( next_list_index === _via_loaded_img_fn_list_file_index.length ) {
        next_list_index = 0;
      }
      var next_img_index = _via_loaded_img_fn_list_file_index[next_list_index];
      show_image(next_img_index);
    } else {
      if ( _via_loaded_img_fn_list_file_index.length === 0 ) {
        show_message('Filtered file list does not any files!');
      } else {
        show_image( _via_loaded_img_fn_list_file_index[0] );
      }
    }

    if (typeof _via_hook_next_image === 'function') {
      _via_hook_next_image(current_img_index);
    }
  }
}

function set_zoom(zoom_level_index) {
  if ( zoom_level_index === VIA_CANVAS_DEFAULT_ZOOM_LEVEL_INDEX ) {
    _via_is_canvas_zoomed = false;
    _via_canvas_zoom_level_index = VIA_CANVAS_DEFAULT_ZOOM_LEVEL_INDEX;
  } else {
    _via_is_canvas_zoomed = true;
    _via_canvas_zoom_level_index = zoom_level_index;
  }

  var zoom_scale = VIA_CANVAS_ZOOM_LEVELS[_via_canvas_zoom_level_index];
  set_all_canvas_scale(zoom_scale);
  set_all_canvas_size(_via_canvas_width  * zoom_scale,
                      _via_canvas_height * zoom_scale);
  _via_canvas_scale = _via_canvas_scale_without_zoom / zoom_scale;

  _via_load_canvas_regions(); // image to canvas space transform
  _via_redraw_reg_canvas();
  _via_reg_canvas.focus();
}

function reset_zoom_level() {
  if (!_via_current_image_loaded) {
    show_message('First load some images!');
    return;
  }
  if (_via_is_canvas_zoomed) {
    set_zoom(VIA_CANVAS_DEFAULT_ZOOM_LEVEL_INDEX);
    show_message('Zoom reset');
  } else {
    show_message('Cannot reset zoom because image zoom has not been applied!');
  }
}

function zoom_in() {
  if (!_via_current_image_loaded) {
    show_message('First load some images!');
    return;
  }

  if (_via_canvas_zoom_level_index === (VIA_CANVAS_ZOOM_LEVELS.length-1)) {
    show_message('Further zoom-in not possible');
  } else {
    var new_zoom_level_index = _via_canvas_zoom_level_index + 1;
    set_zoom( new_zoom_level_index );
    show_message('Zoomed in to level ' + VIA_CANVAS_ZOOM_LEVELS[_via_canvas_zoom_level_index] + 'X');
  }
}

function zoom_out() {
  if (!_via_current_image_loaded) {
    show_message('First load some images!');
    return;
  }

  if (_via_canvas_zoom_level_index === 0) {
    show_message('Further zoom-out not possible');
  } else {
    var new_zoom_level_index = _via_canvas_zoom_level_index - 1;
    set_zoom( new_zoom_level_index );
    show_message('Zoomed out to level ' + VIA_CANVAS_ZOOM_LEVELS[_via_canvas_zoom_level_index] + 'X');
  }
}

function toggle_region_boundary_visibility() {
  _via_is_region_boundary_visible = !_via_is_region_boundary_visible;
  _via_redraw_reg_canvas();
  _via_reg_canvas.focus();
}

function toggle_region_id_visibility() {
  _via_is_region_id_visible = !_via_is_region_id_visible;
  _via_redraw_reg_canvas();
  _via_reg_canvas.focus();
}

//
// Mouse wheel event listener
//
window.addEventListener('wheel', function(e) {
  if (!_via_current_image_loaded) {
    return;
  }

  if (e.ctrlKey) {
    if (e.deltaY < 0) {
      zoom_in();
    } else {
      zoom_out();
    }
    e.preventDefault();
  }
});

//
// Persistence of annotation data in browser cache (i.e. localStorage)
//

function check_local_storage() {
  // https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API
  try {
    var x = '__storage_test__';
    localStorage.setItem(x, x);
    localStorage.removeItem(x);
    return true;
  }
  catch(e) {
    return false;
  }
}

function save_current_data_to_browser_cache() {
  setTimeout(function() {
    if ( _via_is_local_storage_available &&
         ! _via_is_save_ongoing) {
      try {
        _via_is_save_ongoing = true;
        var img_metadata = pack_via_metadata('json');
        var timenow = new Date().toUTCString();
        localStorage.setItem('_via_timestamp', timenow);
        localStorage.setItem('_via_img_metadata', img_metadata[0]);
        localStorage.setItem('_via_attributes', JSON.stringify(_via_attributes));
        _via_is_save_ongoing = false;
      } catch(err) {
        _via_is_save_ongoing = false;
        _via_is_local_storage_available = false;
        show_message('Failed to save annotation data to browser cache.');
        alert('Failed to save annotation data to browser cache.');
        console.log('Failed to save annotation data to browser cache');
        console.log(err.message);
      }
    }
  }, 1000);
}

function is_via_data_in_localStorage() {
  return localStorage.getItem('_via_timestamp') &&
    localStorage.getItem('_via_img_metadata');
}

function remove_via_data_from_localStorage() {
  if( check_local_storage() && is_via_data_in_localStorage() ) {
    localStorage.removeItem('_via_timestamp');
    localStorage.removeItem('_via_img_metadata');
  }
}

function show_localStorage_recovery_options() {
  try {
    var hstr = [];
    var saved_date = localStorage.getItem('_via_timestamp');
    var saved_data_size = localStorage.getItem('_via_img_metadata').length / 1024; // in Kb

    hstr.push('<div style="padding: 1em; border: 1px solid #cccccc;">');
    hstr.push('<h3 style="border-bottom: 1px solid #5599FF">Data Recovery from Browser Cache</h3>');
    hstr.push('<p>Annotation data from your previous session exists in this browser\'s cache :</h3>');
    hstr.push('<ul><li>Saved on : ' + saved_date + '</li>');
    hstr.push('<li>Size : ' + Math.round(saved_data_size) + ' KB</li>');
    hstr.push('</ul>');
    hstr.push('<span class="text_button" title="Save annotations as JSON" onclick="download_localStorage_data(\'json\')">Save</span>');
    hstr.push('<span class="text_button" style="padding-left:2em;" onclick="remove_via_data_from_localStorage(); show_home_panel();" title="Discard annotation data">Discard</span>');

    hstr.push('<p style="clear: left;"><b>If you continue, the cached data will be discarded!</b></p></div>');
    document.getElementById( VIA_DISPLAY_AREA_CONTENT_NAME.PAGE_START_INFO ).innerHTML += hstr.join('');
  } catch(err) {
    show_message('Failed to recover annotation data saved in browser cache.');
    console.log('Failed to recover annotation data saved in browser cache.');
    console.log(err.message);
  }
}

function download_localStorage_data(type) {
  var saved_date = new Date( localStorage.getItem('_via_timestamp') );

  var localStorage_data_blob = new Blob( [localStorage.getItem('_via_img_metadata')],
                                         {type: 'text/json;charset=utf-8'});

  save_data_to_local_file(localStorage_data_blob, 'VIA_browser_cache_' + saved_date + '.json');
}

// this vertical spacer is needed to allow scrollbar to show
// items like Keyboard Shortcut hidden under the attributes panel
function update_vertical_space() {
  var panel = document.getElementById('vertical_space');
  panel.style.height = attributes_panel.offsetHeight+'px';
}


//
// left sidebar toolbox maintainer
//
function toggle_leftsidebar() {
  var leftsidebar = document.getElementById('leftsidebar');
  if ( leftsidebar.style.display === 'none' ) {
    leftsidebar.style.display = 'table-cell';
    document.getElementById('leftsidebar_collapse_button').innerHTML ='&ltrif;';
  } else {
    leftsidebar.style.display = 'none';
    document.getElementById('leftsidebar_collapse_button').innerHTML ='&rtrif;';
  }
}
function show_leftsidebar() {
  var leftsidebar = document.getElementById('leftsidebar');
  leftsidebar.style.display = 'table-cell';
  document.getElementById('leftsidebar_collapse_button').innerHTML ='&ltrif;';
}

// source: https://www.w3schools.com/howto/howto_js_accordion.asp
function init_leftsidebar_accordion() {
  var acc = document.getElementsByClassName('leftsidebar_accordion');
  var i;
  for ( i = 0; i < acc.length; ++i ) {
    acc[i].addEventListener('click', function() {
      this.classList.toggle('active');
      this.nextElementSibling.classList.toggle('show');

      switch( this.innerHTML ) {
      case 'Attributes':
        update_attributes_update_panel();
        break;
      case 'Project':
        update_img_fn_list();
        break;
      }
    });
  }
}

//
// image filename list shown in leftsidebar panel
//
function is_img_fn_list_visible() {
  return img_fn_list_panel.classList.contains('show');
}

function img_loading_spinbar(image_index, show) {
  //var panel = document.getElementById('toolbar_operation_progress_spinbar');
  var panel = document.getElementById('project_panel_title');
  if ( show ) {
    panel.innerHTML = 'Project <span style="margin-left:1rem;" class="loading_spinbox"></span>';
  } else {
    panel.innerHTML = 'Project';
  }
}

function update_img_fn_list() {
  var regex = document.getElementById('img_fn_list_regex').value;
  var p = document.getElementById('filelist_preset_filters_list');
  if ( regex === '' || regex === null ) {
    if ( p.selectedIndex === 0 ) {
      // show all files
      _via_loaded_img_fn_list_table_html = [];
      _via_loaded_img_fn_list_file_index = [];
      _via_loaded_img_fn_list_table_html.push('<ul>');
      for ( var i=0; i < _via_loaded_img_fn_list.length; ++i ) {
        _via_loaded_img_fn_list_table_html.push( img_fn_list_ith_entry_html(i) );
        _via_loaded_img_fn_list_file_index.push(i);
      }
      _via_loaded_img_fn_list_table_html.push('</ul>');
      img_fn_list.innerHTML = _via_loaded_img_fn_list_table_html.join('');
      img_fn_list_scroll_to_current_file();
    } else {
      // filter according to preset filters
      img_fn_list_onpresetfilter_select();
    }
  } else {
    img_fn_list_generate_html(regex);
    img_fn_list.innerHTML = _via_loaded_img_fn_list_table_html.join('');
    img_fn_list_scroll_to_current_file();
  }
}

function img_fn_list_onregex() {
  var regex = document.getElementById('img_fn_list_regex').value;
  img_fn_list_generate_html( regex );
  img_fn_list.innerHTML = _via_loaded_img_fn_list_table_html.join('');
  img_fn_list_scroll_to_current_file();

  // select 'regex' in the predefined filter list
  var p = document.getElementById('filelist_preset_filters_list');
  if ( regex === '' ) {
    p.selectedIndex = 0;
  } else {
    var i;
    for ( i=0; i<p.options.length; ++i ) {
      if ( p.options[i].value === 'regex' ) {
        p.selectedIndex = i;
        break;
      }
    }
  }
}

function img_fn_list_onpresetfilter_select() {
  var p = document.getElementById('filelist_preset_filters_list');
  var filter = p.options[p.selectedIndex].value;
  switch(filter) {
  case 'all':
    document.getElementById('img_fn_list_regex').value = '';
    img_fn_list_generate_html();
    img_fn_list.innerHTML = _via_loaded_img_fn_list_table_html.join('');
    img_fn_list_scroll_to_current_file();
    break;
  case 'regex':
    document.getElementById('img_fn_list_regex').focus();
    break;
  default:
    _via_loaded_img_fn_list_table_html = [];
    _via_loaded_img_fn_list_file_index = [];
    _via_loaded_img_fn_list_table_html.push('<ul>');
    var i;
    for ( i=0; i < _via_loaded_img_fn_list.length; ++i ) {
      var img_id = _via_image_id_list[i];
      var add_to_list = false;
      switch(filter) {
      case 'files_without_region':
        if ( _via_img_metadata[img_id].regions.length === 0 ) {
          add_to_list = true;
        }
        break;
      case 'files_missing_region_annotations':
        if ( is_region_annotation_missing(img_id) ) {
          add_to_list = true;
        }
        break;
      case 'files_missing_file_annotations':
        if ( is_file_annotation_missing(img_id) ) {
          add_to_list = true;
        }
        break;
      }
      if ( add_to_list ) {
        _via_loaded_img_fn_list_table_html.push( img_fn_list_ith_entry_html(i) );
        _via_loaded_img_fn_list_file_index.push(i);
      }
    }
    _via_loaded_img_fn_list_table_html.push('</ul>');
    img_fn_list.innerHTML = _via_loaded_img_fn_list_table_html.join('');
    img_fn_list_scroll_to_current_file();
    break;
  }
}

function is_region_annotation_missing(img_id) {
  var region_attribute;
  var i;
  for ( i = 0; i < _via_img_metadata[img_id].regions.length; ++i ) {
    for ( region_attribute in _via_attributes['region'] ) {
      if ( _via_img_metadata[img_id].regions[i].region_attributes.hasOwnProperty(region_attribute) ) {
        if ( _via_img_metadata[img_id].regions[i].region_attributes[region_attribute] === '' ) {
          return true;
        }
      } else {
        return true;
      }
    }
  }
  return false;
}

function is_file_annotation_missing(img_id) {
  var file_attribute;
  for ( file_attribute in _via_attributes['file'] ) {
    if ( _via_img_metadata[img_id].file_attributes.hasOwnProperty(file_attribute) ) {
      if ( _via_img_metadata[img_id].file_attributes[file_attribute] === '' ) {
        return true;
      }
    } else {
      return true;
    }
  }
  return false;
}

function img_fn_list_ith_entry_html(i) {
  var htmli = '';
  var filename = _via_loaded_img_fn_list[i];
  if ( i === _via_image_index ) {
    // highlight the current entry
    htmli += '<li id="flist'+i+'" class="highlight">';
    htmli += '[' + (i+1) + '] ' + filename;
  } else {
    htmli += '<li id="flist'+i+'" onclick="jump_to_image(' + (i) + ')">';
    htmli += '[' + (i+1) + '] ' + filename;
  }
  htmli += '</li>';
  return htmli;
}

function img_fn_list_generate_html(regex) {
  _via_loaded_img_fn_list_table_html = [];
  _via_loaded_img_fn_list_file_index = [];
  _via_loaded_img_fn_list_table_html.push('<ul>');
  for ( var i=0; i < _via_loaded_img_fn_list.length; ++i ) {
    var filename = _via_loaded_img_fn_list[i];
    if ( filename.match(regex) !== null ) {
      _via_loaded_img_fn_list_table_html.push( img_fn_list_ith_entry_html(i) );
      _via_loaded_img_fn_list_file_index.push(i);
    }
  }
  _via_loaded_img_fn_list_table_html.push('</ul>');
}

function img_fn_list_scroll_to_current_file() {
  if( _via_loaded_img_fn_list_file_index.includes(_via_image_index) ) {
    var sel_file     = document.getElementById( 'flist' + _via_image_index );
    var panel_height = img_fn_list.clientHeight;
    if ( sel_file.offsetTop > ( img_fn_list.scrollTop + panel_height) ) {
      img_fn_list.scrollTop = sel_file.offsetTop;
    }
  }
}

function toggle_img_fn_list_visibility() {
  document.getElementById('img_fn_list_panel').classList.toggle('show');
  document.getElementById('loaded_img_panel_title').classList.toggle('active');
}

//
// region and file attributes update panel
//
function attribute_update_panel_set_active_button() {
  var attribute_type;
  for ( attribute_type in _via_attributes ) {
    var bid = 'button_show_' + attribute_type + '_attributes';
    document.getElementById(bid).classList.remove('active');
  }
  var bid = 'button_show_' + _via_attribute_being_updated + '_attributes';
  document.getElementById(bid).classList.add('active');
}

function show_region_attributes_update_panel() {
  if ( _via_attribute_being_updated !== 'region' ) {
    _via_attribute_being_updated = 'region';
    update_attributes_update_panel();
    attribute_update_panel_set_active_button();
  }
}

function show_file_attributes_update_panel() {
  if ( _via_attribute_being_updated !== 'file' ) {
    _via_attribute_being_updated = 'file';
    update_attributes_update_panel();
    attribute_update_panel_set_active_button();
  }
}

function update_attributes_name_list() {
  var p = document.getElementById('attributes_name_list');
  if ( p.options.length !== 0 ) {
    // to retain the old selected attribute
    var attribute_name0 = p.options[ p.selectedIndex ].value;
    var attribute_desc0 = p.options[ p.selectedIndex ].innerHTML;
    p.innerHTML = '';
  }
  for ( attr in _via_attributes[_via_attribute_being_updated] ) {
    var o = document.createElement('option');
    o.setAttribute('value', attr)
    //o.text = _via_attributes[_via_attribute_being_updated][attr].description;
    o.text = attr;
    if ( attribute_name0 === attr ||
         attribute_desc0 === o.text ) {
      o.setAttribute('selected', 'selected');
    }
    p.add(o);
  }
}

function update_attributes_update_panel() {
  if ( document.getElementById('attributes_editor_panel').classList.contains('show') ) {
    update_attributes_name_list();
    show_attribute_properties();
    show_attribute_options();
  }
}

function update_attribute_properties_panel() {
  if ( document.getElementById('attributes_editor_panel').classList.contains('show') ) {
    show_attribute_properties();
    show_attribute_options();
  }
}

function show_attribute_properties() {
  var attr_list = document.getElementById('attributes_name_list');
  document.getElementById('attribute_properties').innerHTML = '';

  if ( attr_list.options.length === 0 ) {
    return;
  }

  var attr_id = attr_list.value;
  var attr_type = _via_attributes[_via_attribute_being_updated][attr_id].type;
  var attr_desc = _via_attributes[_via_attribute_being_updated][attr_id].description;


  attribute_property_add_input_property('Name of attribute (appears in exported annotations)',
                                        'Name',
                                        attr_id,
                                        'attribute_name');
  attribute_property_add_input_property('Description of attribute (shown to user during annotation session)',
                                        'Desc.',
                                        attr_desc,
                                        'attribute_description');

  if ( attr_type === 'text' ) {
    var attr_default_value = _via_attributes[_via_attribute_being_updated][attr_id].default_value;
    attribute_property_add_input_property('Default value of this attribute',
                                          'Def.',
                                          attr_default_value,
                                          'attribute_default_value');
  }

  // add dropdown for type of attribute
  var p = document.createElement('div');
  p.setAttribute('class', 'property');
  var c0 = document.createElement('span');
  c0.setAttribute('title', 'Attribute type (e.g. text, checkbox, radio, etc)');
  c0.innerHTML = 'Type';
  var c1 = document.createElement('span');
  var c1b = document.createElement('select');
  c1b.setAttribute('onchange', 'attribute_property_on_update(this)');
  c1b.setAttribute('id', 'attribute_type');
  var type_id;
  for ( type_id in VIA_ATTRIBUTE_TYPE ) {
    var type = VIA_ATTRIBUTE_TYPE[type_id];
    var option = document.createElement('option');
    option.setAttribute('value', type);
    option.innerHTML = type;
    if ( attr_type == type ) {
      option.setAttribute('selected', 'selected');
    }
    c1b.appendChild(option);
  }
  c1.appendChild(c1b);
  p.appendChild(c0);
  p.appendChild(c1);
  document.getElementById('attribute_properties').appendChild(p);
}

function show_attribute_options() {
  var attr_list = document.getElementById('attributes_name_list');
  if ( attr_list.options.length === 0 ) {
    return;
  }

  var attr_id = attr_list.value;
  var attr_type = _via_attributes[_via_attribute_being_updated][attr_id].type;

  // populate additional options based on attribute type
  document.getElementById('attribute_options').innerHTML = '';
  switch( attr_type ) {
  case VIA_ATTRIBUTE_TYPE.TEXT:
    // text does not have any additional properties
    break;
  case VIA_ATTRIBUTE_TYPE.IMAGE:
    var p = document.createElement('div');
    p.setAttribute('class', 'property');
    p.setAttribute('style', 'text-align:center');
    var c0 = document.createElement('span');
    c0.setAttribute('style', 'width:25%');
    c0.setAttribute('title', 'When selected, this is the value that appears in exported annotations');
    c0.innerHTML = 'id';
    var c1 = document.createElement('span');
    c1.setAttribute('style', 'width:60%');
    c1.setAttribute('title', 'URL or base64 (see https://www.base64-image.de/) encoded image data that corresponds to the image shown as an option to the annotator');
    c1.innerHTML = 'image url or b64';
    var c2 = document.createElement('span');
    c2.setAttribute('title', 'The default value of this attribute');
    c2.innerHTML = 'def.';
    p.appendChild(c0);
    p.appendChild(c1);
    p.appendChild(c2);
    document.getElementById('attribute_options').appendChild(p);

    var options = _via_attributes[_via_attribute_being_updated][attr_id].options;
    var option_id;
    for ( option_id in options ) {
      var option_desc = options[option_id];

      var option_default = _via_attributes[_via_attribute_being_updated][attr_id].default_options[option_id];
      attribute_property_add_option(attr_id, option_id, option_desc, option_default, attr_type);
    }
    attribute_property_add_new_entry_option(attr_id, attr_type);
    break;
  case VIA_ATTRIBUTE_TYPE.CHECKBOX: // handled by next case
  case VIA_ATTRIBUTE_TYPE.RADIO:
    var p = document.createElement('div');
    p.setAttribute('class', 'property');
    p.setAttribute('style', 'text-align:center');
    var c0 = document.createElement('span');
    c0.setAttribute('style', 'width:25%');
    c0.setAttribute('title', 'When selected, this is the value that appears in exported annotations');
    c0.innerHTML = 'id';
    var c1 = document.createElement('span');
    c1.setAttribute('style', 'width:60%');
    c1.setAttribute('title', 'This is the text shown as an option to the annotator');
    c1.innerHTML = 'description';
    var c2 = document.createElement('span');
    c2.setAttribute('title', 'The default value of this attribute');
    c2.innerHTML = 'def.';
    p.appendChild(c0);
    p.appendChild(c1);
    p.appendChild(c2);
    document.getElementById('attribute_options').appendChild(p);

    var options = _via_attributes[_via_attribute_being_updated][attr_id].options;
    var option_id;
    for ( option_id in options ) {
      var option_desc = options[option_id];

      var option_default = _via_attributes[_via_attribute_being_updated][attr_id].default_options[option_id];
      attribute_property_add_option(attr_id, option_id, option_desc, option_default, attr_type);
    }
    attribute_property_add_new_entry_option(attr_id, attr_type);
    break;
  default:
    console.log('Attribute type ' + attr_type + ' is unavailable');
  }
}

function attribute_property_add_input_property(title, name, value, id) {
  var p = document.createElement('div');
  p.setAttribute('class', 'property');
  var c0 = document.createElement('span');
  c0.setAttribute('title', title);
  c0.innerHTML = name;
  var c1 = document.createElement('span');
  var c1b = document.createElement('input');
  c1b.setAttribute('onblur', 'attribute_property_on_update(this)');
  if ( typeof(value) !== 'undefined' ) {
    c1b.setAttribute('value', value);
  }
  c1b.setAttribute('id', id);
  c1.appendChild(c1b);
  p.appendChild(c0);
  p.appendChild(c1);

  document.getElementById('attribute_properties').appendChild(p);
}

function attribute_property_add_option(attr_id, option_id, option_desc, option_default, attribute_type) {
  var p = document.createElement('div');
  p.setAttribute('class', 'property');
  var c0 = document.createElement('span');
  var c0b = document.createElement('input');
  c0b.setAttribute('value', option_id);
  c0b.setAttribute('title', option_id);
  c0b.setAttribute('onblur', 'attribute_property_on_option_update(this)');
  c0b.setAttribute('id', '_via_attribute_option_id_' + option_id);

  var c1 = document.createElement('span');
  var c1b = document.createElement('input');
  c1b.setAttribute('value', option_desc);
  c1b.setAttribute('title', option_desc);
  c1b.setAttribute('onblur', 'attribute_property_on_option_update(this)');
  c1b.setAttribute('id', '_via_attribute_option_description_' + option_id);

  var c2 = document.createElement('span');
  var c2b = document.createElement('input');
  c2b.setAttribute('type', attribute_type);
  if ( typeof option_default !== 'undefined' ) {
    c2b.checked = option_default;
  }
  if ( attribute_type === 'radio' || attribute_type === 'image' ) {
    // ensured that user can activate only one radio button
    c2b.setAttribute('type', 'radio');
    c2b.setAttribute('name', attr_id);
  }
  c2b.setAttribute('onclick', 'attribute_property_on_option_update(this)');
  c2b.setAttribute('id', '_via_attribute_option_default_' + option_id);

  c0.appendChild(c0b);
  c1.appendChild(c1b);
  c2.appendChild(c2b);
  p.appendChild(c0);
  p.appendChild(c1);
  p.appendChild(c2);

  document.getElementById('attribute_options').appendChild(p);
}

function attribute_property_add_new_entry_option(attr_id, attribute_type) {
  var p = document.createElement('div');
  p.setAttribute('class', 'property');

  var c0 = document.createElement('span');
  var c0b = document.createElement('input');
  c0b.setAttribute('type', 'text');
  c0b.setAttribute('value', '');
  c0b.setAttribute('onblur', 'attribute_property_on_option_add(this)');
  c0b.setAttribute('id', '_via_attribute_new_option_id');
  c0b.setAttribute('placeholder', 'Add new id');

  c0.appendChild(c0b);
  p.appendChild(c0);

  document.getElementById('attribute_options').appendChild(p);
}

function attribute_property_on_update(p) {
  var attr_id = get_current_attribute_id();
  switch(p.id) {
  case 'attribute_name':
    var new_attr = p.value;
    if ( new_attr !== attr_id ) {
      Object.defineProperty(_via_attributes[_via_attribute_being_updated],
                            new_attr,
                            Object.getOwnPropertyDescriptor(_via_attributes[_via_attribute_being_updated], attr_id));

      delete _via_attributes[_via_attribute_being_updated][attr_id];
      update_attributes_update_panel();
      update_annotation_editor();
    }
    break;
  case 'attribute_description':
    _via_attributes[_via_attribute_being_updated][attr_id].description = p.value;
    update_attributes_update_panel();
    update_annotation_editor();
    break;
  case 'attribute_default_value':
    _via_attributes[_via_attribute_being_updated][attr_id].default_value = p.value;
    update_attributes_update_panel();
    update_annotation_editor();
    break;
  case 'attribute_type':
    _via_attributes[_via_attribute_being_updated][attr_id].type = p.value;
    if( p.value === VIA_ATTRIBUTE_TYPE.TEXT ) {
      _via_attributes[_via_attribute_being_updated][attr_id].default_value = '';
      delete _via_attributes[_via_attribute_being_updated][attr_id].options;
      delete _via_attributes[_via_attribute_being_updated][attr_id].default_options;
    } else {
      _via_attributes[_via_attribute_being_updated][attr_id].options = {};
      _via_attributes[_via_attribute_being_updated][attr_id].default_options = {};
      delete _via_attributes[_via_attribute_being_updated][attr_id].default_value;
    }
    show_attribute_properties();
    show_attribute_options();
    update_annotation_editor();
    break;
  }
}

function attribute_property_on_option_update(p) {
  var attr_id = get_current_attribute_id();
  if ( p.id.startsWith('_via_attribute_option_id_') ) {
    var old_key = p.id.substr( '_via_attribute_option_id_'.length );
    var new_key = p.value;
    if ( old_key !== new_key ) {
      var option_id_test = attribute_property_option_id_is_valid(new_key);
      if ( option_id_test.is_valid ) {
        update_attribute_option_id_with_confirm(_via_attribute_being_updated,
                                                attr_id,
                                                old_key,
                                                new_key);
      } else {
        show_message( option_id_test.message );
        show_attribute_properties();
      }
      return;
    }
  }

  if ( p.id.startsWith('_via_attribute_option_description_') ) {
    var key = p.id.substr( '_via_attribute_option_description_'.length );
    var old_value = _via_attributes[_via_attribute_being_updated][attr_id].options[key];
    if ( p.value !== old_value ) {
      _via_attributes[_via_attribute_being_updated][attr_id].options[key] = p.value;
      show_attribute_properties();
      update_annotation_editor();
    }
  }

  if ( p.id.startsWith('_via_attribute_option_default_') ) {
    var key = p.id.substr( '_via_attribute_option_default_'.length );
    var old_value = _via_attributes[_via_attribute_being_updated][attr_id].default_options[key];
    if ( typeof old_value === 'undefined' ) {
      _via_attributes[_via_attribute_being_updated][attr_id].default_options[key] = p.checked;
      show_attribute_properties();
      update_annotation_editor();
    } else {
      if ( p.value !== old_value ) {
        switch ( _via_attributes[_via_attribute_being_updated][attr_id].type ) {
        case 'radio':
          // to ensure that only one radio button is selected at a time
          _via_attributes[_via_attribute_being_updated][attr_id].default_options = {};
          _via_attributes[_via_attribute_being_updated][attr_id].default_options[key] = p.checked;
          break;
        case 'checkbox':
          _via_attributes[_via_attribute_being_updated][attr_id].default_options[key] = p.checked;
        }
        show_attribute_properties();
        update_annotation_editor();
      }
    }
  }
}

function attribute_property_on_option_add(p) {
  if ( p.value === '' || p.value === null ) {
    return;
  }
  if ( p.id === '_via_attribute_new_option_id' ) {
    var option_id = p.value;
    var option_id_test = attribute_property_option_id_is_valid(option_id);
    if ( option_id_test.is_valid ) {
      var attr_id = get_current_attribute_id();
      var attribute_type = _via_attributes[_via_attribute_being_updated][attr_id].type;

      _via_attributes[_via_attribute_being_updated][attr_id].options[option_id] = '';
      show_attribute_options();
      update_annotation_editor();
    } else {
      show_message( option_id_test.message );
      attribute_property_reset_new_entry_inputs();
    }
  }
}

function attribute_property_reset_new_entry_inputs() {
  var container = document.getElementById('attribute_options');
  var p = container.lastChild;
  if ( p.childNodes[0] ) {
    if ( p.childNodes[0].childNodes ) {
      p.childNodes[0].childNodes[0].value = '';
    }
  }
  if ( p.childNodes[1] ) {
    if ( p.childNodes[1].childNodes ) {
      p.childNodes[1].childNodes[0].value = '';
    }
  }
}

function attribute_property_show_new_entry_inputs(attr_id, attribute_type) {
  var n0 = document.createElement('div');
  n0.classList.add('property');
  var n1a = document.createElement('span');
  var n1b = document.createElement('input');
  n1b.setAttribute('onblur', 'attribute_property_on_option_add(this)');
  n1b.setAttribute('placeholder', 'Add new id');
  n1b.setAttribute('value', '');
  n1b.setAttribute('id', '_via_attribute_new_option_id');
  n1a.appendChild(n1b);

  var n2a = document.createElement('span');
  var n2b = document.createElement('input');
  n2b.setAttribute('onblur', 'attribute_property_on_option_add(this)');
  n2b.setAttribute('placeholder', 'Optional description');
  n2b.setAttribute('value', '');
  n2b.setAttribute('id', '_via_attribute_new_option_description');
  n2a.appendChild(n2b);

  var n3a = document.createElement('span');
  var n3b = document.createElement('input');
  n3b.setAttribute('type', attribute_type);
  if ( attribute_type === 'radio' ) {
    n3b.setAttribute('name', attr_id);
  }
  n3b.setAttribute('onblur', 'attribute_property_on_option_add(this)');
  n3b.setAttribute('id', '_via_attribute_new_option_default');
  n3a.appendChild(n3b);

  n0.appendChild(n1a);
  n0.appendChild(n2a);
  n0.appendChild(n3a);

  var container = document.getElementById('attribute_options');
  container.appendChild(n0);
}

function attribute_property_option_id_is_valid(id) {
  var option_id;
  for ( option_id in _via_attributes[_via_attribute_being_updated][attr].options ) {
    if ( option_id === id ) {
      return { 'is_valid':false, 'message':'Option id [' + id + '] already exists' };
    }
  }

  if ( id.includes('__') ) { // reserved separator for attribute-id, row-id, option-id
    return {'is_valid':false, 'message':'Option id cannot contain two consecutive underscores'};
  }

  return {'is_valid':true};
}

function attribute_property_id_exists(name) {
  var attr_name;
  for ( attr_name in _via_attributes[_via_attribute_being_updated] ) {
    if ( attr_name === name ) {
      return true;
    }
  }
  return false;
}

function delete_existing_attribute_with_confirm() {
  var attr_id = document.getElementById('user_input_attribute_id').value;
  if ( attr_id === '' ) {
    show_message('Enter the name of attribute that you wish to delete');
    return;
  }
  if ( attribute_property_id_exists(attr_id) ) {
    var config = {'title':'Delete ' + _via_attribute_being_updated + ' attribute [' + attr + ']' };
    var input = { 'attr_type':{'type':'text', 'name':'Attribute Type', 'value':_via_attribute_being_updated, 'disabled':true},
                  'attr_id':{'type':'text', 'name':'Attribute Id', 'value':attr_id, 'disabled':true},
                  'confirm':
                  {
                    type:'checkbox',
                    name:'Confirm (by checking box) that you understand that deleting an attribute will delete all annotations associated with this attribute across all the files. <span class="warning">These deleted content cannot be recovered.</span>',
                    value:false
                  }
                };
    invoke_with_user_inputs(delete_existing_attribute_confirmed, input, config);
  } else {
    show_message('Attribute [' + attr_id + '] does not exist!');
    return;
  }
}

function delete_existing_attribute_confirmed(input) {
  if ( input.confirm.value ) {
    var attr_type = input.attr_type.value;
    var attr_id   = input.attr_id.value;
    delete_existing_attribute(attr_type, attr_id);
    document.getElementById('user_input_attribute_id').value = '';
    show_message('Deleted ' + attr_type + ' attribute [' + attr_id + ']');
  } else {
    show_message('You must tick the checkbox to confirm deletion of attribute.');
  }
}

function delete_existing_attribute(attribute_type, attribute_id) {
  delete _via_attributes[attribute_type][attribute_id];
  update_attributes_update_panel();
}

function add_new_attribute_from_user_input() {
  var attr = document.getElementById('user_input_attribute_id').value;
  if ( attr === '' ) {
    show_message('Enter the name of attribute that you wish to delete');
    return;
  }
  if ( attribute_property_id_exists(attr) ) {
    show_message('The ' + _via_attribute_being_updated + ' attribute [' + attr + '] already exists.');
    return
  } else {
    add_new_attribute(attr);
    update_attributes_update_panel();
    document.getElementById('attributes_name_list').value = attr;
    update_attribute_properties_panel();
    update_annotation_editor();
    show_message('Added ' + _via_attribute_being_updated + ' attribute [' + attr + '].');
  }
}

function add_new_attribute(attribute_id) {
  _via_attributes[_via_attribute_being_updated][attribute_id] = {};
  _via_attributes[_via_attribute_being_updated][attribute_id].type = 'text';
  _via_attributes[_via_attribute_being_updated][attribute_id].description = '';
  _via_attributes[_via_attribute_being_updated][attribute_id].default_value = '';
}

function get_current_attribute_id() {
  var attr_id = document.getElementById('attributes_name_list').value;
  return attr_id;
}

function update_attribute_option_id_with_confirm(attr_type, attr_id, option_id, new_option_id) {
  var is_delete = false;
  var config;
  if ( new_option_id === '' || typeof(new_option_id) === 'undefined' ) {
    // an empty new_option_id indicates deletion of option_id
    config = {'title':'Delete an option for ' + attr_type + ' attribute'};
    is_delete = true;
  } else {
    config = {'title':'Rename an option for ' + attr_type + ' attribute'};
  }

  var input = { 'attr_type':{'type':'text', 'name':'Attribute Type', 'value':attr_type, 'disabled':true},
                'attr_id':{'type':'text', 'name':'Attribute Id', 'value':attr_id, 'disabled':true}
              };

  if ( is_delete ) {
    input['option_id'] = {'type':'text', 'name':'Attribute Option', 'value':option_id, 'disabled':true};
    input['confirm'] = {'type':'checkbox',
                        'name':'Confirm (by checking box) that you understand the following: Deleting an option in ' + attr_type + ' attribute will delete all annotations with this option. <span class="warning">WARNING: this process cannot be undone.</span>',
                        'value':false};
  } else {
    input['option_id']     = {'type':'text', 'name':'Attribute Option (old)', 'value':option_id, 'disabled':true},
    input['new_option_id'] = {'type':'text', 'name':'Attribute Option (new)', 'value':new_option_id, 'disabled':true};
    input['confirm'] = {'type':'checkbox',
                        'name':'Confirm (by checking box) that you understand the following: Renaming an option in ' + attr_type + ' attribute will rename all annotations with this option. <span class="warning">WARNING: this process cannot be undone.</span>',
                        'value':false};
  }

  invoke_with_user_inputs(update_attribute_option_id_confirmed, input, config, update_attribute_option_id_cancel);
}

function update_attribute_option_id_cancel(input) {
  update_attribute_properties_panel();
}

function update_attribute_option_id_confirmed(input) {
  var attr_type = input.attr_type.value;
  var attr_id = input.attr_id.value;
  var option_id = input.option_id.value;
  var is_delete;
  var new_option_id;
  if ( typeof(input.new_option_id) === 'undefined' || input.new_option_id === '' ) {
    is_delete = true;
    new_option_id = '';
  } else {
    is_delete = false;
    new_option_id = input.new_option_id.value;
  }

  update_attribute_option(is_delete, attr_type, attr_id, option_id, new_option_id);

  if ( is_delete ) {
    show_message('Deleted option [' + option_id + '] for ' + attr_type + ' attribute [' + attr_id + '].');
  } else {
    show_message('Renamed option [' + option_id + '] to [' + new_option_id + '] for ' + attr_type + ' attribute [' + attr_id + '].');
  }
  update_attribute_properties_panel();
  update_annotation_editor();
}

function update_attribute_option(is_delete, attr_type, attr_id, option_id, new_option_id) {
  switch ( attr_type ) {
  case 'region':
    update_region_attribute_option_in_all_metadata(is_delete, attr_id, option_id, new_option_id);
    if ( ! is_delete ) {
      Object.defineProperty(_via_attributes[attr_type][attr_id].options,
                            new_option_id,
                            Object.getOwnPropertyDescriptor(_via_attributes[_via_attribute_being_updated][attr_id].options, option_id));
    }
    delete _via_attributes['region'][attr_id].options[option_id];

    break;
  case 'file':
    update_file_attribute_option_from_all_metadata(attr_id, option_id);
    if ( ! is_delete ) {
      Object.defineProperty(_via_attributes[attr_type][attr_id].options,
                            new_option_id,
                            Object.getOwnPropertyDescriptor(_via_attributes[_via_attribute_being_updated][attr_id].options, option_id));
    }

    delete _via_attributes['file'][attr_id].options[option_id];
    break;
  }
}

function update_region_attribute_option_in_all_metadata(is_delete, attr_id, option_id, new_option_id) {
  var image_id;
  for ( image_id in _via_img_metadata ) {
    if ( _via_img_metadata.hasOwnProperty(image_id) ) {
      update_region_attribute_option_from_metadata(image_id, is_delete, attr_id, option_id, new_option_id);
    }
  }
}
1
function update_region_attribute_option_from_metadata(image_id, is_delete, attr_id, option_id, new_option_id) {
  var i;
  for ( i = 0; i < _via_img_metadata[image_id].regions.length; ++i ) {
    if ( _via_img_metadata[image_id].regions[i].region_attributes.hasOwnProperty(attr_id) ) {
      if ( _via_img_metadata[image_id].regions[i].region_attributes[attr_id].hasOwnProperty(option_id) ) {
        Object.defineProperty(_via_img_metadata[image_id].regions[i].region_attributes[attr_id],
                              new_option_id,
                              Object.getOwnPropertyDescriptor(_via_img_metadata[image_id].regions[i].region_attributes[attr_id], option_id));
        delete _via_img_metadata[image_id].regions[i].region_attributes[attr_id][option_id];
      }
    }
  }
}

function delete_file_attribute_option_from_all_metadata(attr_id, option_id) {
  var image_id;
  for ( image_id in _via_img_metadata ) {
    if ( _via_img_metadata.hasOwnProperty(image_id) ) {
      delete_file_attribute_option_from_metadata(image_id, attr_id, option_id);
    }
  }
}

function delete_file_attribute_option_from_metadata(image_id, attr_id, option_id) {
  var i;
  if ( _via_img_metadata[image_id].file_attributes.hasOwnProperty(attr_id) ) {
    if ( _via_img_metadata[image_id].file_attributes[attr_id].hasOwnProperty(option_id) ) {
      delete _via_img_metadata[image_id].file_attributes[attr_id][option_id];
    }
  }
}

function delete_file_attribute_from_all_metadata(image_id, attr_id) {
  var image_id;
  for ( image_id in _via_img_metadata ) {
    if ( _via_img_metadata.hasOwnProperty(image_id) ) {
      if ( _via_img_metadata[image_id].file_attributes.hasOwnProperty(attr_id) ) {
        delete _via_img_metadata[image_id].file_attributes[attr_id];
      }
    }
  }
}

//
// invoke a method after receiving inputs from user
//
function invoke_with_user_inputs(ok_handler, input, config, cancel_handler) {
  setup_user_input_panel(ok_handler, input, config, cancel_handler);
  show_user_input_panel();
}

function setup_user_input_panel(ok_handler, input, config, cancel_handler) {
  // create html page with OK and CANCEL button
  // when OK is clicked
  //  - setup input with all the user entered values
  //  - invoke handler with input
  // when CANCEL is clicked
  //  - invoke user_input_cancel()
  _via_user_input_ok_handler = ok_handler;
  _via_user_input_cancel_handler = cancel_handler;
  _via_user_input_data = input;

  var p = document.getElementById('user_input_panel');
  var c = document.createElement('div');
  c.setAttribute('class', 'content');
  var html = [];
  html.push('<p class="title">' + config.title + '</p>');

  html.push('<div class="user_inputs">');
  var key;
  for ( key in _via_user_input_data ) {
    html.push('<div class="row">');
    html.push('<span class="cell">' + _via_user_input_data[key].name + '</span>');
    var disabled_html = '';
    if ( _via_user_input_data[key].disabled ) {
      disabled_html = 'disabled="disabled"';
    }
    var value_html = '';
    if ( _via_user_input_data[key].value ) {
      value_html = 'value="' + _via_user_input_data[key].value + '"';
    }

    switch(_via_user_input_data[key].type) {
    case 'checkbox':
      if ( _via_user_input_data[key].checked ) {
        value_html = 'checked="checked"';
      } else {
        value_html = '';
      }
      html.push('<span class="cell">' +
                '<input class="_via_user_input_variable" ' +
                value_html + ' ' +
                disabled_html + ' ' +
                'type="checkbox" id="' + key + '"></span>');
      break;
    case 'text':
      var size = '';
      if ( _via_user_input_data[key].size ) {
        size = _via_user_input_data[key].size;
      }
      var placeholder = '';
      if ( _via_user_input_data[key].placeholder ) {
        placeholder = _via_user_input_data[key].placeholder;
      }
      html.push('<span class="cell">' +
                '<input class="_via_user_input_variable" ' +
                value_html + ' ' +
                disabled_html + ' ' +
                'size="' + size + '" ' +
                'placeholder="' + placeholder + '" ' +
                'type="text" id="' + key + '"></span>');

      break;
    }
    html.push('</div>'); // end of row
  }
  html.push('</div>'); // end of user_input div
  html.push('<div class="user_confirm">' +
            '<span class="ok">' +
            '<button onclick="user_input_parse_and_invoke_handler()">&nbsp;OK&nbsp;</button></span>' +
            '<span class="cancel">' +
            '<button onclick="user_input_cancel_handler()">CANCEL</button></span></div>');
  c.innerHTML = html.join('');
  p.innerHTML = '';
  p.appendChild(c);

}

function user_input_default_cancel_handler() {
  hide_user_input_panel();
  _via_user_input_data = {};
  _via_user_input_ok_handler = null;
  _via_user_input_cancel_handler = null;
}

function user_input_cancel_handler() {
  if ( _via_user_input_cancel_handler ) {
    _via_user_input_cancel_handler();
  }
  user_input_default_cancel_handler();
}

function user_input_parse_and_invoke_handler() {
  var elist = document.getElementsByClassName('_via_user_input_variable');
  var i;
  for ( i=0; i < elist.length; ++i ) {
    var eid = elist[i].id;
    if ( _via_user_input_data.hasOwnProperty(eid) ) {
      switch(_via_user_input_data[eid].type) {
      case 'checkbox':
        _via_user_input_data[eid].value = elist[i].checked;
        break;
      default:
        _via_user_input_data[eid].value = elist[i].value;
        break;
      }
    }
  }
  if ( typeof(_via_user_input_data.confirm) !== 'undefined' ) {
    if ( _via_user_input_data.confirm.value ) {
      _via_user_input_ok_handler(_via_user_input_data);
    } else {
      if ( _via_user_input_cancel_handler ) {
        _via_user_input_cancel_handler();
      }
    }
  } else {
    _via_user_input_ok_handler(_via_user_input_data);
  }
  user_input_default_cancel_handler();
}

function show_user_input_panel() {
  document.getElementById('user_input_panel').style.display = 'block';
}

function hide_user_input_panel() {
  document.getElementById('user_input_panel').style.display = 'none';
}

//
// annotations editor panel
//
function annotation_editor_set_active_button() {
  var attribute_type;
  for ( attribute_type in _via_attributes ) {
    var bid = 'button_edit_' + attribute_type + '_metadata';
    document.getElementById(bid).classList.remove('active');
  }
  var bid = 'button_edit_' + _via_metadata_being_updated + '_metadata';
  document.getElementById(bid).classList.add('active');
}

function edit_region_metadata_in_annotation_editor() {
  _via_metadata_being_updated = 'region';
  annotation_editor_set_active_button();
  update_annotation_editor();
}
function edit_file_metadata_in_annotation_editor() {
  _via_metadata_being_updated = 'file';
  annotation_editor_set_active_button();
  update_annotation_editor();
}

function is_annotation_editor_visible() {
  return document.getElementById('annotation_editor_panel').classList.contains('display_block');
}

function toggle_annotation_editor() {
  var p = document.getElementById('annotation_editor_panel');
  if ( p.classList.contains('display_block') ) {
    p.classList.remove('display_block');
  } else {
    p.classList.add('display_block');
    p.style.height = _via_settings.ui.annotation_editor_height + '%';
    p.style.fontSize = _via_settings.ui.annotation_editor_fontsize + 'rem';
    update_annotation_editor();
  }
}

function update_annotation_editor() {
  var p = document.getElementById('annotation_editor_panel');
  if ( p.classList.contains('display_block') ) {
    var ae = document.getElementById('annotation_editor');
    ae.innerHTML = '';
    annotation_editor_update_header_html();
    annotation_editor_update_metadata_html();
  }
}

function annotation_editor_update_header_html() {
  var head = document.createElement('div');
  head.setAttribute('class', 'row');
  head.setAttribute('id', 'annotation_editor_header');

  if ( _via_metadata_being_updated === 'region' ) {
    var rid_col = document.createElement('span');
    rid_col.setAttribute('class', 'col');
    rid_col.innerHTML = '';
    head.appendChild(rid_col);
  }

  var attr_id;
  for ( attr_id in _via_attributes[_via_metadata_being_updated] ) {
    var col = document.createElement('span');
    col.setAttribute('class', 'col header');
    col.innerHTML = attr_id;
    head.appendChild(col);
  }

  var ae = document.getElementById('annotation_editor');
  if ( ae.childNodes.length === 0 ) {
    ae.appendChild(head);
  } else {
    if ( ae.firstChild.id === 'annotation_editor_header') {
      ae.replaceChild(head, ae.firstChild);
    } else {
      // header node is absent
      ae.insertBefore(head, ae.firstChild);
    }
  }
}

function annotation_editor_update_metadata_html() {
  var ae = document.getElementById('annotation_editor');
  switch ( _via_metadata_being_updated ) {
  case 'region':
    var rindex;
    for ( rindex = 0; rindex < _via_img_metadata[_via_image_id].regions.length; ++rindex ) {
      ae.appendChild( annotation_editor_get_metadata_row_html(rindex) );
    }
    break;
  case 'file':
    ae.appendChild( annotation_editor_get_metadata_row_html(0) );
    break;
  }

}

function annotation_editor_update_row(row_id) {
  var ae = document.getElementById('annotation_editor');

  var new_row = annotation_editor_get_metadata_row_html(row_id);
  var old_row = document.getElementById(new_row.getAttribute('id'));
  ae.replaceChild(new_row, old_row);
}

function annotation_editor_add_row(row_id) {
  if ( is_annotation_editor_visible() ) {
    var ae = document.getElementById('annotation_editor');
    var new_row = annotation_editor_get_metadata_row_html(row_id);
    var penultimate_row_id = parseInt(row_id) - 1;
    if ( penultimate_row_id >= 0 ) {
      var penultimate_row_html_id = 'ae_' + _via_metadata_being_updated + '_' + penultimate_row_id;
      var penultimate_row = document.getElementById(penultimate_row_html_id);
      ae.insertBefore(new_row, penultimate_row.nextSibling);
    }
  }
}

function annotation_editor_get_metadata_row_html(row_id) {
  var row = document.createElement('div');
  row.setAttribute('class', 'row');
  row.setAttribute('id', 'ae_' + _via_metadata_being_updated + '_' + row_id);

  if ( _via_metadata_being_updated === 'region' ) {
    var rid = document.createElement('span');
    rid.setAttribute('class', 'col id');
    rid.innerHTML = (row_id + 1);
    row.appendChild(rid);
  }

  var attr_id;
  for ( attr_id in _via_attributes[_via_metadata_being_updated] ) {
    var col = document.createElement('span');
    col.setAttribute('class', 'col');

    var attr_value = '';
    switch(_via_metadata_being_updated) {
    case 'region':
      if ( _via_img_metadata[_via_image_id].regions[row_id].region_attributes.hasOwnProperty(attr_id) ) {
        attr_value = _via_img_metadata[_via_image_id].regions[row_id].region_attributes[attr_id];
      }
    case 'file':
      if ( _via_img_metadata[_via_image_id].file_attributes.hasOwnProperty(attr_id) ) {
        attr_value = _via_img_metadata[_via_image_id].file_attributes[attr_id];
      }
    }

    var attr_type    = _via_attributes[_via_metadata_being_updated][attr_id].type;
    var attr_desc    = _via_attributes[_via_metadata_being_updated][attr_id].desc;
    var attr_html_id = attr_id + '__' + row_id;

    switch(attr_type) {
    case 'text':
      if ( attr_value === '' ) {
        attr_value = _via_attributes[_via_metadata_being_updated][attr_id].default_value;
      }
      col.innerHTML = '<textarea ' +
        'onchange="annotation_editor_on_metadata_update(this)" ' +
        'title="' + attr_desc + '" ' +
        'id="' + attr_html_id + '">' + attr_value + '</textarea>';
      break;
    case 'checkbox':
      var options = _via_attributes[_via_metadata_being_updated][attr_id].options;
      var option_id;
      for ( option_id in options ) {
        var option_html_id = attr_html_id + '__' + option_id;
        var option = document.createElement('input');
        option.setAttribute('type', 'checkbox');
        option.setAttribute('value', option_id);
        option.setAttribute('id', option_html_id);
        option.setAttribute('onchange', 'annotation_editor_on_metadata_update(this)');

        var option_desc  = _via_attributes[_via_metadata_being_updated][attr_id].options[option_id];
        if ( option_desc === '' || typeof(option_desc) === 'undefined' ) {
          // option description is optional, use option_id when description is not present
          option_desc = option_id;
        }

        // set the value of options based on the user annotations
        if ( typeof attr_value !== 'undefined') {
          if ( attr_value.hasOwnProperty(option_id) ) {
            option.checked = attr_value[option_id];
          }
        }

        var label  = document.createElement('label');
        label.setAttribute('for', option_html_id);
        label.innerHTML = option_desc;

        var container = document.createElement('span');
        container.appendChild(option);
        container.appendChild(label);
        col.appendChild(container);
      }
      break;
    case 'radio':
      var option_id;
      for ( option_id in _via_attributes[_via_metadata_being_updated][attr_id].options ) {
        var option_html_id = attr_html_id + '__' + option_id;
        var option = document.createElement('input');
        option.setAttribute('type', 'radio');
        option.setAttribute('name', attr_html_id);
        option.setAttribute('value', option_id);
        option.setAttribute('id', option_html_id);
        option.setAttribute('onchange', 'annotation_editor_on_metadata_update(this)');

        var option_desc  = _via_attributes[_via_metadata_being_updated][attr_id].options[option_id];
        if ( option_desc === '' || typeof(option_desc) === 'undefined' ) {
          // option description is optional, use option_id when description is not present
          option_desc = option_id;
        }

        if ( attr_value === option_id ) {
          option.checked = true;
        }

        var label  = document.createElement('label');
        label.setAttribute('for', option_html_id);
        label.innerHTML = option_desc;

        var container = document.createElement('span');
        container.appendChild(option);
        container.appendChild(label);
        col.appendChild(container);
      }
      break;
    case 'image':
      var option_id;
      var option_count = 0;
      for ( option_id in _via_attributes[_via_metadata_being_updated][attr_id].options ) {
        option_count = option_count + 1;
      }
      var img_options = document.createElement('div');
      img_options.setAttribute('class', 'img_options');
      col.appendChild(img_options);

      var option_index = 0;
      for ( option_id in _via_attributes[_via_metadata_being_updated][attr_id].options ) {
        var option_html_id = attr_html_id + '__' + option_id;
        var option = document.createElement('input');
        option.setAttribute('type', 'radio');
        option.setAttribute('name', attr_html_id);
        option.setAttribute('value', option_id);
        option.setAttribute('id', option_html_id);
        option.setAttribute('onchange', 'annotation_editor_on_metadata_update(this)');

        var option_desc  = _via_attributes[_via_metadata_being_updated][attr_id].options[option_id];
        if ( option_desc === '' || typeof(option_desc) === 'undefined' ) {
          // option description is optional, use option_id when description is not present
          option_desc = option_id;
        }

        if ( attr_value === option_id ) {
          option.checked = true;
        }

        var label  = document.createElement('label');
        label.setAttribute('for', option_html_id);
        label.innerHTML = '<img src="' + option_desc + '"><p>' + option_id + '</p>';

        var container = document.createElement('span');
        container.appendChild(option);
        container.appendChild(label);
        img_options.appendChild(container);
      }
      break;
    }

    row.appendChild(col);
  }
  return row;
}

function annotation_editor_scroll_to_row(row_id) {
  if ( is_annotation_editor_visible() ) {
    var row_html_id = 'ae_' + _via_metadata_being_updated + '_' + row_id;
    var row = document.getElementById(row_html_id);
    row.scrollIntoView(false);
  }
}

function annotation_editor_highlight_row(row_id) {
  if ( is_annotation_editor_visible() ) {
    var row_html_id = 'ae_' + _via_metadata_being_updated + '_' + row_id;
    var row = document.getElementById(row_html_id);
    row.classList.add('highlight');
  }
}

function annotation_editor_clear_row_highlight() {
  if ( is_annotation_editor_visible() ) {
    var ae = document.getElementById('annotation_editor');
    var i;
    for ( i=0; i<ae.childNodes.length; ++i ) {
      ae.childNodes[i].classList.remove('highlight');
    }
  }
}

function annotation_editor_extract_html_id_components(html_id) {
  // html_id : attribute_name__row-id__option_id
  var parts = html_id.split('__');
  var parsed_id = {};
  switch( parts.length ) {
  case 3:
    // html_id : attribute-id__row-id__option_id
    parsed_id.attr_id = parts[0];
    parsed_id.row_id  = parts[1];
    parsed_id.option_id = parts[2];
    break;
  case 2:
    // html_id : attribute-id__row-id
    parsed_id.attr_id = parts[0];
    parsed_id.row_id  = parts[1];
    break;
  default:
  }
  return parsed_id;
}

// invoked when the user updates annotations using the annotation editor
function annotation_editor_on_metadata_update(p) {
  var pid = annotation_editor_extract_html_id_components(p.id);
  var attr_type = _via_attributes[_via_attribute_being_updated][pid.attr_id].type;

  switch( attr_type ) {
  case 'text':
    _via_img_metadata[_via_image_id].regions[pid.row_id].region_attributes[pid.attr_id] = p.value;
    break;
  case 'radio':
    _via_img_metadata[_via_image_id].regions[pid.row_id].region_attributes[pid.attr_id] = p.value;
    break;
  case 'image':
    _via_img_metadata[_via_image_id].regions[pid.row_id].region_attributes[pid.attr_id] = p.value;
    break;
  case 'checkbox':
    var option_id = p.value;
    if ( ! _via_img_metadata[_via_image_id].regions[pid.row_id].region_attributes[pid.attr_id] ) {
      _via_img_metadata[_via_image_id].regions[pid.row_id].region_attributes[pid.attr_id] = {};
    }

    if ( p.checked ) {
      _via_img_metadata[_via_image_id].regions[pid.row_id].region_attributes[pid.attr_id][option_id] = true;
    } else {
      // false option values are not stored
      delete _via_img_metadata[_via_image_id].regions[pid.row_id].region_attributes[pid.attr_id][option_id];
    }
    break;
  }

  //console.log('annotation updated: attr_id='+pid.attr_id+', row_id='+pid.row_id+', option_id='+pid.option_id);
  //console.log(_via_img_metadata[_via_image_id].regions[pid.row_id].region_attributes);
}

function set_region_annotations_to_default_value(rid) {
  var attr_id;
  for ( attr_id in _via_attributes['region'] ) {
    var attr_type = _via_attributes['region'][attr_id].type;
    switch( attr_type ) {
    case 'text':
      var default_value = _via_attributes['region'][attr_id].default_value;
      if ( typeof(default_value) !== 'undefined' ) {
        _via_img_metadata[_via_image_id].regions[rid].region_attributes[attr_id] = default_value;
      }
      break;
    case 'radio':
      _via_img_metadata[_via_image_id].regions[rid].region_attributes[attr_id] = '';
      var default_options = _via_attributes['region'][attr_id].default_options;
      if ( typeof(default_options) !== 'underfined' ) {
        var option_id;
        for ( option_id in default_options ) {
          // a radio input has single value
          _via_img_metadata[_via_image_id].regions[rid].region_attributes[attr_id] = option_id;
        }
      }
      break;
    case 'image':
      _via_img_metadata[_via_image_id].regions[rid].region_attributes[attr_id] = '';
      var default_options = _via_attributes['region'][attr_id].default_options;
      if ( typeof(default_options) !== 'underfined' ) {
        var option_id;
        for ( option_id in default_options ) {
          // a radio input has single value
          _via_img_metadata[_via_image_id].regions[rid].region_attributes[attr_id] = option_id;
        }
      }
      break;

    case 'checkbox':
      _via_img_metadata[_via_image_id].regions[rid].region_attributes[attr_id] = {};
      var default_options = _via_attributes['region'][attr_id].default_options;
      if ( typeof(default_options) !== 'underfined' ) {
        var option_id;
        for ( option_id in default_options ) {
          var default_value = default_options[option_id];
          if ( typeof(default_value) !== 'underfined' ) {
            _via_img_metadata[_via_image_id].regions[rid].region_attributes[attr_id][option_id] = default_value;
          }
        }
      }
      break;
    }
  }
}

function set_file_annotations_to_default_value(image_id) {
  var attr_id;
  for ( attr_id in _via_attributes['file'] ) {
    var attr_type = _via_attributes['file'][attr_id].type;
    switch( attr_type ) {
    case 'text':
      var default_value = _via_attributes['file'][attr_id].default_value;
      _via_img_metadata[image_id].file_attributes[attr_id] = default_value;
      break;
    case 'radio': // handled by case 'checkbox'
      _via_img_metadata[image_id].file_attributes[attr_id] = '';
      var default_options = _via_attributes['file'][attr_id].default_options;
      var option_id;
      for ( option_id in default_options ) {
        // a radio input has single value
        _via_img_metadata[image_id].file_attributes[attr_id] = option_id;
      }
      break;
    case 'checkbox':
      _via_img_metadata[image_id].file_attributes[attr_id] = {};
      var default_options = _via_attributes['file'][attr_id].default_options;
      var option_id;
      for ( option_id in default_options ) {
        var default_value = default_options[option_id];
        _via_img_metadata[image_id].file_attributes[attr_id][option_id] = default_value;
      }
      break;
    }
  }
}

function annotation_editor_increase_panel_height() {
  var p = document.getElementById('annotation_editor_panel');
  if ( _via_settings.ui.annotation_editor_height < 95 ) {
    _via_settings.ui.annotation_editor_height += VIA_ANNOTATION_EDITOR_HEIGHT_CHANGE;
    p.style.height = _via_settings.ui.annotation_editor_height + '%';
  }
}

function annotation_editor_decrease_panel_height() {
  var p = document.getElementById('annotation_editor_panel');
  if ( _via_settings.ui.annotation_editor_height > 10 ) {
    _via_settings.ui.annotation_editor_height -= VIA_ANNOTATION_EDITOR_HEIGHT_CHANGE;
    p.style.height = _via_settings.ui.annotation_editor_height + '%';
  }
}

function annotation_editor_increase_content_size() {
  var p = document.getElementById('annotation_editor_panel');
  if ( _via_settings.ui.annotation_editor_fontsize < 1.6 ) {
    _via_settings.ui.annotation_editor_fontsize += VIA_ANNOTATION_EDITOR_FONTSIZE_CHANGE;
    p.style.fontSize = _via_settings.ui.annotation_editor_fontsize + 'rem';
  }
}

function annotation_editor_decrease_content_size() {
  var p = document.getElementById('annotation_editor_panel');
  if ( _via_settings.ui.annotation_editor_fontsize > 0.4 ) {
    _via_settings.ui.annotation_editor_fontsize -= VIA_ANNOTATION_EDITOR_FONTSIZE_CHANGE;
    p.style.fontSize = _via_settings.ui.annotation_editor_fontsize + 'rem';
  }
}

//
// via project
//
function project_set_name(name) {
  _via_settings.project.name = name;

  var p = document.getElementById('project_name');
  p.value = _via_settings.project.name;
}

function project_init_default_project() {
  if ( ! _via_settings.hasOwnProperty('project') ) {
    _via_settings.project = {};
  }

  project_set_name( project_get_default_project_name() );

  var p = document.getElementById('project_name');
  p.setAttribute('value', _via_settings.project.name);
}

function project_on_name_update() {
  var p = document.getElementById('project_name');
  _via_settings.project.name = p.value;
}

function project_get_default_project_name() {
  const now = new Date();
  var MONTH_SHORT_NAME = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var ts = now.getDate() + MONTH_SHORT_NAME[now.getMonth()] + now.getFullYear() +
      '_' + now.getHours() + 'h' + now.getMinutes() + 'm';

  //var project_name = 'via_project_' + _via_image_id_list.length + 'files_' + ts;
  var project_name = 'via_project_' + ts;
  return project_name;
}

function project_save_with_confirm() {
  var config = {'title':'Save Project' };
  var input = { 'project_name': { type:'text', name:'Project Name', value:_via_settings.project.name, disabled:false, size:30 },
                'save_annotations':{ type:'checkbox', name:'Save region and file annotations (i.e. manual annotations)', checked:true, disabled:false},
                'save_attributes':{ type:'checkbox', name:'Save region and file attributes.', checked:true},
                'save_via_settings':{ type:'checkbox', name:'Save VIA application settings', checked:true},
                //                'save_images':{type:'checkbox', 'name':'Save images <span class="warning">(WARNING: only recommended for projects containing small number of images)</span>', value:false},
              };
  invoke_with_user_inputs(project_save_confirmed, input, config);
}

function project_save_confirmed(input) {
  console.log(input)
  if ( input.project_name.value !== _via_settings.project.name ) {
    project_set_name(input.project_name.value);
  }

  // via project
  var _via_project = { '_via_settings': _via_settings,
                       '_via_img_metadata': JSON.parse(JSON.stringify(_via_img_metadata)), // clone
                       '_via_attributes': _via_attributes };

  var filename = input.project_name.value + '.json';
  var data_blob = new Blob( [JSON.stringify(_via_project)],
                            {type: 'text/json;charset=utf-8'});

  save_data_to_local_file(data_blob, filename);

  user_input_default_cancel_handler();
}

function project_open_select_project_file() {
  if (invisible_file_input) {
    invisible_file_input.accept = '.json';
    invisible_file_input.onchange = project_open;
    invisible_file_input.removeAttribute('multiple');
    invisible_file_input.click();
  }
}

function project_open(event) {
  var selected_file = event.target.files[0];
  load_text_file(selected_file, project_open_parse_json_file);
}

function project_open_parse_json_file(project_file_data) {
  var d = JSON.parse(project_file_data);
  if ( d['_via_settings'] && d['_via_img_metadata'] && d['_via_attributes'] ) {
    _via_settings = d['_via_settings'];
    _via_attributes = d['_via_attributes'];
    _via_img_metadata = d['_via_img_metadata'];

    // reset internal variables
    _via_image_id_list = [];
    _via_loaded_img_fn_list = [];
    _via_img_count = 0;
    var img_id;
    for ( img_id in _via_img_metadata ) {
      _via_image_id_list.push(img_id);
      _via_loaded_img_fn_list.push( _via_img_metadata[img_id].filename );
      set_file_annotations_to_default_value(img_id);
      _via_img_count += 1;
    }

    show_message('Imported project [' + _via_settings['project'].name + '] with ' + _via_img_count + ' files.');

    if ( _via_img_count > 0 ) {
      show_image(0);
      update_img_fn_list();
      _via_reload_img_fn_list_table = true;
    }
  } else {
    show_message('Cannot import project from a corrupt file!');
  }
}

function project_file_remove_with_confirm() {
  var img_id = _via_image_id_list[_via_image_index];
  var filename = _via_img_metadata[img_id].filename;
  var region_count = _via_img_metadata[img_id].regions.length;

  var config = {'title':'Remove File from Project' };
  var input = { 'img_index': { type:'text', name:'File Id', value:(_via_image_index+1), disabled:true },
                'filename':{ type:'text', name:'Filename', value:filename, disabled:true, size:30},
                'region_count':{ type:'text', name:'Number of regions', disabled:true, value:region_count},
                'confirm':{ type:'checkbox', name:'Confirm (by checking box) that you understand the following: <span class="warning">Removing a file from this project will remove all the region and file annotations associated with this file.</span>', checked:false},
              };

  invoke_with_user_inputs(project_file_remove_confirmed, input, config);
}

function project_file_remove_confirmed(input) {
  if ( input.confirm.value ) {
    var img_index = input.img_index.value - 1;
    var img_id = _via_image_id_list[img_index];
    var filename = _via_img_metadata[img_id].filename;

    var old_via_image_id_list = _via_image_id_list.slice(0);
    var old_via_loaded_img_fn_list = _via_loaded_img_fn_list.slice(0);

    _via_image_id_list = [];
    _via_loaded_img_fn_list = [];
    _via_img_count = 0;
    var i;
    for ( i = 0; i < old_via_image_id_list.length; ++i ) {
      var img_id_i = old_via_image_id_list[i];
      if ( img_id_i !== img_id ) {
        _via_image_id_list.push( img_id_i );
        _via_loaded_img_fn_list.push( _via_img_metadata[img_id_i].filename );
        _via_img_count += 1;
      }
    }
    _via_reload_img_fn_list_table = true;
    update_img_fn_list();
    if ( _via_img_count === 0 ) {
      _via_current_image_loaded = false;
      show_home_panel();
    } else {
      move_to_next_image();
    }

    delete _via_img_metadata[img_id];

    show_message('Removed file [' + filename + '] from project');
  }
  user_input_default_cancel_handler();
}

function project_file_add_local(event) {
  var user_selected_images = event.target.files;
  var original_image_count = _via_img_count;

  // clear browser cache if user chooses to load new images
  if (original_image_count === 0) {
    remove_via_data_from_localStorage();
  }

  var discarded_file_count = 0;
  for ( var i = 0; i < user_selected_images.length; ++i ) {
    var filetype = user_selected_images[i].type.substr(0, 5);
    if ( filetype === 'image' ) {
      var filename = user_selected_images[i].name;
      var size     = user_selected_images[i].size;
      var img_id   = _via_get_image_id(filename, size);

      if ( _via_img_metadata.hasOwnProperty(img_id) ) {
        if ( _via_img_metadata[img_id].fileref ) {
          show_message('Image ' + filename + ' already loaded. Skipping!');
        } else {
          _via_img_metadata[img_id].fileref = user_selected_images[i];
          show_message('Regions already exist for file ' + filename + ' !');
        }
      } else {
        _via_img_metadata[img_id] = new ImageMetadata(user_selected_images[i],
                                                      filename,
                                                      size);
        _via_image_id_list.push(img_id);
        _via_loaded_img_fn_list.push(filename);
        set_file_annotations_to_default_value(img_id);
        _via_img_count += 1;
        _via_reload_img_fn_list_table = true;
      }
    } else {
      discarded_file_count += 1;
    }
  }

  if ( _via_img_metadata ) {
    var status_msg = 'Loaded ' + (_via_img_count - original_image_count) + ' images.';
    if ( discarded_file_count ) {
      status_msg += ' ( Discarded ' + discarded_file_count + ' non-image files! )';
    }
    show_message(status_msg);

    if ( _via_image_index === -1 ) {
      show_image(0);
    } else {
      show_image( original_image_count );
    }
    update_img_fn_list();
  } else {
    show_message("Please upload some image files!");
  }
}

function project_file_add_abs_path_with_input() {
  var config = {'title':'Add File using Absolute Path' };
  var input = { 'absolute_path': { type:'text', name:'Absolute path', placeholder:'/home/abhishek/image1.jpg', disabled:false, size:50 }
              };

  invoke_with_user_inputs(project_file_add_abs_path_input_done, input, config);
}

function project_file_add_abs_path_input_done(input) {
  var abs_path = input.absolute_path.value.trim();
  project_file_add_url(abs_path);
  show_message('Added file at absolute path [' + abs_path + ']');
  update_img_fn_list();
  user_input_default_cancel_handler();
}

function project_file_add_url_with_input() {
  var config = {'title':'Add File using URL' };
  var input = { 'url': { type:'text', name:'URL', placeholder:'http://www.robots.ox.ac.uk/~vgg/software/via/images/swan.jpg', disabled:false, size:50 }
              };

  invoke_with_user_inputs(project_file_add_url_input_done, input, config);
}

function project_file_add_url_input_done(input) {
  var url = input.url.value.trim();
  project_file_add_url(url);
  show_message('Added file at url [' + url + ']');
  update_img_fn_list();
  user_input_default_cancel_handler();
}

function project_file_add_url(url) {
  if ( url !== '' ) {
    var size = -1; // convention: files added using url have size = -1
    var img_id   = _via_get_image_id(url, size);

    if ( _via_img_metadata.hasOwnProperty(img_id) ) {
      if ( _via_img_metadata[img_id].fileref ) {
        show_message('Image [' + _via_img_metadata[img_id].filename + '] already loaded. Skipping!');
      } else {
        _via_img_metadata[img_id].fileref = filename;
        show_message('Regions already exist for file ' + filename + ' !');
      }
    } else {
      _via_img_metadata[img_id] = new ImageMetadata(url,
                                                    url,
                                                    size);
      _via_image_id_list.push(img_id);
      _via_loaded_img_fn_list.push(url);
      set_file_annotations_to_default_value(img_id);
      _via_img_count += 1;
      _via_reload_img_fn_list_table = true;
    }
  }
}

//
// image grid
//
function image_grid_init() {
  var p = document.getElementById('image_grid_content');
  p.addEventListener('mousedown', image_grid_mousedown_handler, false);
  p.addEventListener('mouseup', image_grid_mouseup_handler, false);
  p.addEventListener('mousemove', image_grid_mousemove_handler, false);
  p.addEventListener('dblclick', image_grid_dblclick_handler, false);
}

function image_grid_update() {
  if ( _via_display_area_content_name === VIA_DISPLAY_AREA_CONTENT_NAME.IMAGE_GRID ) {
    image_grid_set_content(0);
  }
}

function image_grid_set_content( image_grid_first_image_index ) {
  _via_image_grid_current_page_first_img_index = image_grid_first_image_index;

  var pc = document.getElementById('image_grid_content');
  pc.innerHTML = '';
  var de = document.documentElement;
  pc.style.height = (de.clientHeight - 4*ui_top_panel.offsetHeight) + 'px';
  //pc.style.height = '200px';

  var i = _via_image_grid_current_page_first_img_index;
  for ( ; i < _via_image_id_list.length; ++i ) {
    var img_id = _via_image_id_list[i];
    var e = document.createElement('img');
    if (_via_img_metadata[img_id].base64_img_data === '') {
      if ( _via_img_metadata[img_id].fileref instanceof File ) {
        var img_reader = new FileReader();
        img_reader.addEventListener( "error", function() {
          //@todo
        }, false);
        img_reader.addEventListener( "load", function() {
          e.src = img_reader.result;
        }, false);
        img_reader.readAsDataURL( _via_img_metadata[img_id].fileref );
      } else {
        e.src = _via_img_metadata[img_id].fileref;
      }
    } else {
      e.src = _via_img_metadata[img_id].base64_img_data;
    }
    e.setAttribute('class', 'im');
    e.setAttribute('id', image_grid_get_html_img_id(i));
    e.setAttribute('height', _via_settings.ui.image_grid_panel_img_height + '%');

    pc.appendChild(e);
  }

}

function image_grid_image_size_increase() {
  var new_img_height = _via_settings.ui.image_grid_panel_img_height + VIA_IMAGE_GRID_IMG_HEIGHT_CHANGE;
  if ( new_img_height < 91 ) {
    _via_settings.ui.image_grid_panel_img_height = new_img_height;
    image_grid_update();
    image_grid_info('Image height set to ' + _via_settings.ui.image_grid_panel_img_height + ' %');
  } else {
    image_grid_info('Cannot increase image size anymore than ' + _via_settings.ui.image_grid_panel_img_height + ' %');
  }
}

function image_grid_image_size_decrease() {
  var new_img_height = _via_settings.ui.image_grid_panel_img_height - VIA_IMAGE_GRID_IMG_HEIGHT_CHANGE;
  if ( new_img_height > 0.1 ) {
    _via_settings.ui.image_grid_panel_img_height = new_img_height;
    image_grid_info('Image height set to ' + _via_settings.ui.image_grid_panel_img_height + ' %');
    image_grid_update();
  } else {
    image_grid_info('Cannot reduce image size anymore than ' + _via_settings.ui.image_grid_panel_img_height + ' %');
  }
}

function image_grid_info(msg) {
  document.getElementById('image_grid_info').innerHTML = msg;
  setTimeout( function() {
    document.getElementById('image_grid_info').innerHTML = '';
  }, VIA_THEME_MESSAGE_TIMEOUT_MS);
}

function image_grid_mousedown_handler(e) {
  e.preventDefault();
  _via_image_grid_mousedown_img_index = image_grid_parse_html_img_id(e.target.id);
  console.log('mousedown on image index ' + _via_image_grid_mousedown_img_index);
}

function image_grid_mousemove_handler(e) {
  e.preventDefault();
  //console.log(e.target.src)
}

function image_grid_mouseup_handler(e) {
  e.preventDefault();
  console.log(e);
  _via_image_grid_mouseup_img_index = image_grid_parse_html_img_id(e.target.id);
  console.log('mouseup on image index ' + _via_image_grid_mouseup_img_index);

  if ( _via_image_grid_mouseup_img_index === _via_image_grid_mousedown_img_index ) {
    // select single image
    _via_image_grid_selected_fileid_list.push(_via_image_grid_mousedown_img_index);
  } else {
    // select multiple images
    var start = _via_image_grid_mousedown_img_index;
    var end   = _via_image_grid_mouseup_img_index;
    if ( _via_image_grid_mousedown_img_index > _via_image_grid_mouseup_img_index ) {
      var tmp = start;
      start = end;
      end = tmp;
    }
    console.log('selecting from ' + start + ' to ' + end);
    var i;
    for ( i = start; i <= end; ++i ) {
      _via_image_grid_selected_fileid_list.push(i);
    }
  }
  image_grid_update_selected_img_count();
}

function image_grid_parse_html_img_id(html_img_id) {
  var img_index = html_img_id.substr(2);
  return parseInt(img_index);
}

function image_grid_get_html_img_id(img_index) {
  return 'im' + img_index;
}

function image_grid_dblclick_handler(e) {
  e.preventDefault();
  console.log('double click')
  console.log(e.target.src)
}

function image_grid_update_selected_img_count() {
  document.getElementById('image_grid_sel_img_count').innerHTML = _via_image_grid_selected_fileid_list.length;
}

/*
image_grid_panel.addEventListener('mousedown', function(e) {
  console.log(e.target.src)
  e.preventDefault();
}, true);

image_grid_panel.addEventListener('mousemove', function(e) {
  console.log(e.target.src)
  e.preventDefault();
}, true);

image_grid_panel.addEventListener('mouseup', function(e) {
  console.log(e.target.src)
  e.preventDefault();
}, true);
*/
//
// utils
//

// start with the array having smallest number of elements
// check the remaining arrays if they all contain the elements of this shortest array
function array_intersect( array_list ) {
  if ( array_list.length === 0 ) {
    return [];
  }
  if ( array_list.length === 1 ) {
    return array_list[0];
  }

  var shortest_array = array_list[0];
  var shortest_array_index = 0;
  var i;
  for ( i = 1; i < array_list.length; ++i ) {
    if ( array_list[i].length < shortest_array.length ) {
      shortest_array = array_list[i];
      shortest_array_index = i;
    }
  }

  var intersect = [];
  var element_count = {};

  var array_index_i;
  for ( i = 0; i < array_list.length; ++i ) {
    if ( i === 0 ) {
      // in the first iteration, process the shortest element array
      array_index_i = shortest_array_index;
    } else {
      array_index_i = i;
    }

    var j;
    for ( j = 0; j < array_list[array_index_i].length; ++j ) {
      if ( element_count[ array_list[array_index_i][j] ] === (i-1) ) {
        if ( i === array_list.length - 1 ) {
          intersect.push( array_list[array_index_i][j] );
          element_count[ array_list[array_index_i][j] ] = 0;
        } else {
          element_count[ array_list[array_index_i][j] ] = i;
        }
      } else {
        element_count[ array_list[array_index_i][j] ] = 0;
      }
    }
  }
  return intersect;
}

function generate_img_index_list(input) {
  var all_img_index_list = [];

  // condition: count format a,b
  var count_format_img_index_list = [];
  if ( input.prev_next_count.value !== '' ) {
    var prev_next_split = input.prev_next_count.value.split(',');
    if ( prev_next_split.length === 2 ) {
      var prev = parseInt( prev_next_split[0] );
      var next = parseInt( prev_next_split[1] );
      var i;
      for ( i = (_via_image_index - prev); i <= (_via_image_index + next); i++ ) {
        count_format_img_index_list.push(i);
      }
    }
  }
  if ( count_format_img_index_list.length !== 0 ) {
    all_img_index_list.push(count_format_img_index_list);
  }

  //condition: image index list expression
  var expr_img_index_list = [];
  if ( input.img_index_list.value !== '' ) {
    var img_index_expr = input.img_index_list.value.split(',');
    if ( img_index_expr.length !== 0 ) {
      var i;
      for ( i = 0; i < img_index_expr.length; ++i ) {
        if ( img_index_expr[i].includes('-') ) {
          var ab = img_index_expr[i].split('-');
          var a = parseInt( ab[0] ) - 1; // 0 based indexing
          var b = parseInt( ab[1] ) - 1;
          var j;
          for ( j = a; j <= b; ++j ) {
            expr_img_index_list.push(j);
          }
        } else {
          expr_img_index_list.push( parseInt(img_index_expr[i]) - 1 );
        }
      }
    }
  }
  if ( expr_img_index_list.length !== 0 ) {
    all_img_index_list.push(expr_img_index_list);
  }


  // condition: regular expression
  var regex_img_index_list = [];
  if ( input.regex.value !== '' ) {
    var regex = input.regex.value;
    for ( var i=0; i < _via_loaded_img_fn_list.length; ++i ) {
      var filename = _via_loaded_img_fn_list[i];
      if ( filename.match(regex) !== null ) {
        regex_img_index_list.push(i);
      }
    }
  }
  if ( regex_img_index_list.length !== 0 ) {
    all_img_index_list.push(regex_img_index_list);
  }

  var intersect = array_intersect(all_img_index_list);
  return intersect;
}

//
// hooks for sub-modules
// implemented by sub-modules
//
//function _via_hook_next_image() {}
//function _via_hook_prev_image() {}
