function errorHandler(e) {
  var msg = '';

  switch (e.code) {
    case FileError.QUOTA_EXCEEDED_ERR:
      msg = 'QUOTA_EXCEEDED_ERR';
      break;
    case FileError.NOT_FOUND_ERR:
      msg = 'NOT_FOUND_ERR';
      break;
    case FileError.SECURITY_ERR:
      msg = 'SECURITY_ERR';
      break;
    case FileError.INVALID_MODIFICATION_ERR:
      msg = 'INVALID_MODIFICATION_ERR';
      break;
    case FileError.INVALID_STATE_ERR:
      msg = 'INVALID_STATE_ERR';
      break;
    default:
      msg = 'Unknown Error';
      break;
  };

  console.log('Error: ' + msg);
}
//*

  chrome.fileBrowserPrivate.requestLocalFileSystem(function(fsapi){
    initfs(fsapi);
  })
  console.log('requested local');
//*/ 
/*
  (window.requestFileSystem || window.webkitRequestFileSystem)(window.PERSISTENT, 5*1024*1024, function(fsapi){
    initfs(fsapi)
  },errorHandler)
  console.log('requested temp');
}

//*/

var dropbox = new ModernDropbox(Keys.dropbox.key, Keys.dropbox.secret)

function log(e){
  var div = document.createElement('div');
  div.innerText = e;
  
  document.getElementById('log').appendChild(div);
}

var syncQueue = ['/dropsync/'];
var rfs;

function createDir(rootDirEntry, folders) {
  // Throw out './' or '/' and move on to prevent something like '/foo/.//bar'.
  if (folders[0] == '.' || folders[0] == '') {
    folders = folders.slice(1);
  }
  rootDirEntry.getDirectory(folders[0], {create: true}, function(dirEntry) {
    // Recursively add the new subfolder (if we still have another to create).
    if (folders.length) {
      createDir(dirEntry, folders.slice(1));
    }
  }, errorHandler);
};

function getFile(entry, dbpath){
  if(dbpath[0] == '/') dbpath = dbpath.slice(1);
  dropbox.getFileContents(dbpath,function(e){
    entry.createWriter(function(fileWriter) {
      var bb = new BlobBuilder();   
      bb.append(e);
      fileWriter.write(bb.getBlob());
      log("Writing file "+dbpath);
    }, errorHandler);
  })
}


function sync(){
  if(syncQueue.length == 0) return log("Done Syncing");
  var root = syncQueue.shift();
  if(root[0] == '/') root = root.slice(1);
  dropbox.getDirectoryContents(root,function(e){
    log("Loaded "+root);
    if(e.error) log(e.error);
    for(var i = 0; i < e.contents.length; i++){
      var item = e.contents[i];
      if(item.is_dir){
        syncQueue.push(item.path);
        createDir(rfs, item.path.split('/'));
      }else{
        (function(item){
          rfs.getFile(item.path, {create: false}, function(fileEntry){
            console.log(fileEntry)
            fileEntry.getMetadata(function(e){
              var dbdate = new Date(item.modified);
              var lodate = e.modificationTime;
              var syncdate = new Date(localStorage[item.path]);
              if(dbdate > lodate || !localStorage[item.path] || dbdate > syncdate){
                getFile(fileEntry, item.path);
                localStorage[item.path] = item.modified;
              }else{
                log("Old "+item.path);
              }
            })
          }, function(e){
            if(e.code == FileError.NOT_FOUND_ERR){
              rfs.getFile(item.path, {create: true}, function(fileEntry){
                getFile(fileEntry, item.path);
              })
            }
          });
        })(item);
      }
    }
    setTimeout(function(){
      sync();
    }, 500);
    console.log(e)
  });
}

function initfs(fs){
  window.superfs = fs;
  rfs = fs.root;
  createDir(rfs, syncQueue[0].split('/'));  
  var poll = function(){
    if(dropbox.isAccessGranted()){
      sync();    
    }else{
      setTimeout(poll, 300);
    }
  };
  poll();
  
}
