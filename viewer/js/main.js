"use strict";

var main = function(data) {
  let scene = new THREE.Scene();

  let width  = window.innerWidth;
  let height = window.innerHeight;
  let fov    = 60;
  let aspect = width / height;
  let near   = 1;
  let far    = 1000;
  let camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
  camera.position.set(0, -40, 35);

  let renderer = new THREE.WebGLRenderer();
  renderer.setSize(width, height);
  renderer.setClearColor(new THREE.Color(0xffffff));
  document.getElementById('canvas').appendChild(renderer.domElement);

  let directionalLight = new THREE.DirectionalLight(0xffffff, settings.DIRECTIONAL_LIGHT_LEVEL);
  let ambientLight = new THREE.AmbientLight(0xffffff, settings.AMBIENT_LIGHT_LEVEL);
  directionalLight.position.set(0, -0.5, 0.7);
  scene.add(directionalLight);
  scene.add(ambientLight);

  let circuit = CircuitCreator.create(data);

  CircuitDrawer.draw(circuit, scene);

  let controls = new THREE.OrbitControls(camera);

  //マウスのグローバル変数
  let mouse = {x: 0, y: 0};
  //オブジェクト格納グローバル変数
  let targetList = CircuitDrawer.meshes;

  let changed_meshes = [];
  window.onmousedown = function(event) {
    if(event.target == renderer.domElement) {
      //マウス座標2D変換
      let rect = event.target.getBoundingClientRect();
      mouse.x =  event.clientX - rect.left;
      mouse.y =  event.clientY - rect.top;
      //マウス座標3D変換 width（横）やheight（縦）は画面サイズ
      mouse.x =  (mouse.x / width) * 2 - 1;
      mouse.y = -(mouse.y / height) * 2 + 1;
      // マウスベクトル
      let vector = new THREE.Vector3(mouse.x, mouse.y ,1);
      // vector はスクリーン座標系なので, オブジェクトの座標系に変換
      vector.unproject(camera);
      // 始点, 向きベクトルを渡してレイを作成
      let ray = new THREE.Raycaster(camera.position, vector.sub(camera.position).normalize());
      // クリック判定
      let intersect_meshes = ray.intersectObjects(targetList);
      for(let mesh of changed_meshes) {
        let material = mesh.material;
        //console.info(material.default_color);
        material.color = material.default_color;
      }
      changed_meshes = [];
      // クリックしていた場合
      if(intersect_meshes.length > 0) {
        let bit_id = intersect_meshes[0].object.bit_id;
        console.log('Logical qubit ID: ' + bit_id);
        changed_meshes = circuit.logical_qubits_map[bit_id].meshes;
        for(let mesh of changed_meshes) {
          let material = mesh.material;
          material.default_color = material.color.clone();
          material.color.set(settings.COLOR_SET.SELECTED);
        }
      }
    }
  };

  (function renderLoop() {
    requestAnimationFrame(renderLoop);
    controls.update();
    renderer.render(scene, camera);
  })();
};

var prepareCanvas = function() {
  $('#drop-zone').hide();
  $('#file-selector').hide();
  $('#reset-button').show();
  $('#canvas').show();
};

$(function() {
  let dropZone = $('#drop-zone');
  let fileSelector = $('#file-selector');

  // イベントをキャンセル
  let cancelEvent = function(event) {
    event.preventDefault();
    event.stopPropagation();
    return false;
  };

  // dragenter, dragover イベントのデフォルト処理をキャンセル
  dropZone.on('dragenter', cancelEvent);
  dropZone.on('dragover', cancelEvent);

  // イベントをファイル選択ダイアログの表示に変更
  let openFileSelectionDialog = function(event) {
    fileSelector.click();
    return cancelEvent(event);
  };

  // click イベントをファイル選択ダイアログの表示に変更
  dropZone.on('click', openFileSelectionDialog);

  let readFile = function(file) {
    // ファイルの内容は FileReader で読み込む
    let fileReader = new FileReader();
    fileReader.onload = function(event) {
      // event.target.result に読み込んだファイルの内容が入る
      prepareCanvas();
      let json = event.target.result;
      let data = JSON.parse(json);
      main(data);
    };
    fileReader.readAsText(file);
  };

  // ドロップ時のイベントハンドラの設定
  let handleDroppedFile = function(event) {
    let file = event.originalEvent.dataTransfer.files[0];
    readFile(file);
    // デフォルトの処理をキャンセル
    cancelEvent(event);
    return false;
  };

  // 選択時のイベントハンドラの設定
  let handleSelectedFile = function(event) {
    if(event.target.value === "") return false;
    let file = event.target.files[0];
    readFile(file);
    // デフォルトの処理をキャンセル
    cancelEvent(event);
    return false;
  };

  // ドロップ時のイベントハンドラの設定
  dropZone.on('drop', handleDroppedFile);
  fileSelector.on('change', handleSelectedFile);
});

var loadFile = function(fileName) {
  $.getJSON(fileName, function(data) {
      prepareCanvas();
      main(data);
  });
};

var setSamples = function(settings) {
  let sampleList = 'samples/list.json';

  let markup = '<div class="row">' +
  '<div class="col-md-8"><h6><a href="#" onclick="loadFile(\'samples/${file}\'); hideSamplesModal()">${text}</a></h6></div>' +
  '<div class="col-md-1 offset-md-3">' +
    '<a href="samples/${file}" download="${file}"><img src="images/octicons/cloud-download.svg" /></a>' +
  '</div>' +
  '</div>';

  let navSample = $('#nav-samples');

  $.template('sampleTemplate', markup);

  // サンプルリストの取得に失敗した場合はファイル選択ダイアログ表示
  $.getJSON(sampleList, function(data) {
    $.tmpl("sampleTemplate", data.samples).appendTo("#sample-list");
  })
  .done(function(json) {
    navSample.on('click', showSamplesModal);
  })
  .fail(function(jqXHR, textStatus, errorThrown) {
    navSample.on('click', function() {$('#file-selector').click();});
  });
};

var showSamplesModal = function() {
  $('#samples-modal').modal();
};

var hideSamplesModal = function() {
  $('#samples-modal').modal('hide');
};

var setSettingsForm = function(settings) {
  $('#margin-setting').val(settings.MARGIN);
  $('#color-rough-setting').val(settings.COLOR_SET.ROUGH);
  $('#color-smooth-setting').val(settings.COLOR_SET.SMOOTH);
  if(settings.ENABLED_OVERWRITE_COLORS) $('#color-overwrite-setting').prop('checked', true);
  if(settings.DISPLAY_EDGES_FLAG) $('#display-edges-setting').prop('checked', true);
};

$(function() {
  $('#settings-modal').on('show.bs.modal', setSettingsForm.bind(null, settings));
});

var showSettingsModal = function() {
  $('#settings-modal').modal();
};

var hideSettingsModal = function() {
  $('#settings-modal').modal('hide');
};

var loadSettings = function() {
  let storage = localStorage;

  let margin = storage.getItem('settings.MARGIN');
  let color_set_rough = storage.getItem('settings.COLOR_SET.ROUGH');
  let color_set_smooth = storage.getItem('settings.COLOR_SET.SMOOTH');
  let enabed_overwrite_colors = storage.getItem('settings.ENABLED_OVERWRITE_COLORS');
  let display_edges_flag = storage.getItem('settings.DISPLAY_EDGES_FLAG');

  if(margin) {
    settings.MARGIN = margin;
    settings.PITCH = Number(settings.MARGIN) + 1;
  }
  if(color_set_rough) settings.COLOR_SET.ROUGH = color_set_rough;
  if(color_set_smooth) settings.COLOR_SET.SMOOTH = color_set_smooth;
  if(enabed_overwrite_colors) settings.ENABLED_OVERWRITE_COLORS = Number(enabed_overwrite_colors);
  if(display_edges_flag) settings.DISPLAY_EDGES_FLAG = Number(display_edges_flag);
};

var saveSettings = function() {
  let storage = localStorage;

  storage.setItem('settings.MARGIN', $('#margin-setting').val());
  storage.setItem('settings.COLOR_SET.ROUGH', document.getElementById("color-rough-setting").value);
  storage.setItem('settings.COLOR_SET.SMOOTH', document.getElementById("color-smooth-setting").value);
  storage.setItem('settings.ENABLED_OVERWRITE_COLORS', $('[id=color-overwrite-setting]:checked').val());
  storage.setItem('settings.DISPLAY_EDGES_FLAG', $('[id=display-edges-setting]:checked').val());

  loadSettings();
};

var defaultSettings = {};

var loadDefaultSettings = function() {
  setSettingsForm(defaultSettings);
};

$(document).ready(function() {
  setSamples();
  defaultSettings = $.extend(true, {}, settings);
  loadSettings();
});
