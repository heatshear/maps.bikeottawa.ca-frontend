
function addUpdatedDate(layerName){
  const request = new XMLHttpRequest()
  request.open('GET','https://api.mapbox.com/tilesets/v1/bikeottawa?access_token=sk.eyJ1IjoiYmlrZW90dGF3YSIsImEiOiJjamdyYTJmN2EwMmtoMzJwc3JxM2hoZ3ozIn0.YB1JNmncsPvktmgGU_zK8A')
  request.onload = function () {
    if (request.status >= 200 && request.status < 400) {
      var data = JSON.parse(request.responseText);
      if(data && data instanceof Array){
        const date = new Date(data.find(x => x.id === layerName).modified)
        document.getElementById('dateUpdated').innerHTML = date.toLocaleString();
      }
    }
  }
  request.send()
}

function parseUrl(url)  //workaround for edge that doesn't support URLSearchParams
{
    if (url == "") return {};
    const ret = {};
    for (let i = 0; i < url.length; ++i)
    {
        const par=url[i].split('=', 2);
        if (par.length == 1)
            ret[par[0]] = "";
        else
            ret[par[0]] = decodeURIComponent(par[1].replace(/\+/g, " "));
    }
    return ret;
}

function displayOsmElementInfo(element, lngLat, showTags=[]) {
  const ImportantTags = [ ['name','Name',''],        //[actual OSM tag, display name for tag in popup, tooltip]
                          ['highway','Type',''],
                          ['winter_service', 'Snowplowing', 'Is pathway plowed in winter?'],
                          ['winter_service:quality', 'Plow quality', 'Optional: how well is the path typically plowed?'],
                          ['width', 'Width', 'Width in meters'],
                          ['surface', 'Surface', 'Pathway surface'],
                          ['smoothness', 'Smoothness', 'How smooth is the surface in summer'],
                          ['fixme', 'Other info', 'Describe in a few words if there is anything wrong with this path']
                        ];

  if(typeof element == 'undefined') return;
  const xhr = new XMLHttpRequest()
  xhr.open('GET','https://api.openstreetmap.org/api/0.6/'+element)
  xhr.onload = function () {
    let popup = '<h4><a href="https://www.openstreetmap.org/' + element + '" target="_blank">' + element + '</a></h4><hr>'
    if (xhr.status === 200) {
      const xmlDOM = new DOMParser().parseFromString(xhr.responseText, 'text/xml');
      const tags = Array.from(xmlDOM.getElementsByTagName("tag"));
      popup+='<div id="fform"><form id="feedback"><ul><li><div id="showMapillary"></div></li>'

      for(let key of ImportantTags){
        const t = tags.find(ele => {return ele.attributes['k'].value==key[0]});
        const tag = t ? t.attributes["v"].value : '';
        if(key[0]=='name' && tag=='') continue;
        if(showTags.length>0 && !showTags.includes(key[0])) continue;

        popup += `<li><div class="tooltip">${key[1]}:&nbsp;&nbsp;`;
        if(key[0] == 'width'){
          popup += `<span class="tooltiptext">${key[2]}</span></div><select class="fill-lighten3" name="width" >`;
          ['',0.5,1,1.5,2,2.5,3,4,5,10].forEach(w => popup+=`<option value="${w}" ${tag==w?"selected":""}>${w}</option>`)
          popup += '</select> m\n';
        }
        else if(key[0] == 'surface'){
          popup += `<span class="tooltiptext">${key[2]}</span></div><select class="fill-lighten3" name="surface">`;
          ['','asphalt','concrete','ground','fine_gravel','gravel','paving_stones','wood','grass'].forEach(w => popup+=`<option value="${w}" ${tag==w?"selected":""}>${w}</option>`)
          popup += '</select>\n';
        }
        else if(key[0] == 'smoothness'){
          popup += `<span class="tooltiptext">${key[2]}</span></div><select class="fill-lighten3" name="smoothness">`;
          ['','excellent','good','intermediate','bad','horrible','impassable'].forEach(w => popup+=`<option value="${w}" ${tag==w?"selected":""}>${w}</option>`)
          popup += '</select>\n';
        }
        else if(key[0] == 'winter_service'){
          popup += `<span class="tooltiptext">${key[2]}</span></div><select class="fill-lighten3" id="winter_service" name="winter_service">`;
          ['','yes','no'].forEach(w => popup+=`<option value="${w}" ${tag==w?"selected":""}>${w}</option>`)
          popup += '</select>\n';
        }
        else if(key[0] == 'winter_service:quality'){
          popup += `<span class="tooltiptext">${key[2]}</span></div><select class="fill-lighten3" id="plow_quality" name="plow_quality">`;
          ['','good','intermediate','bad'].forEach(w => popup+=`<option value="${w}" ${tag==w?"selected":""}>${w}</option>`)
          popup += '</select>\n';
        }
        else if(key[0] == 'fixme'){
          popup += `<span class="tooltiptext">${key[2]}</span></div><input type="text" class="fill-lighten3 small"  style="height:initial;padding:initial" id="fixme" value="${tag}">\n`
        }
        else{
          popup += '</div><strong>'+tag+'</strong></li>\n';
        }
      }
      showMapillaryImage(lngLat)
      popup+='</ul>';
      popup+='<input type="hidden" name="link" value="' + window.location.href + '">';
      popup+='<input type="hidden" name="osm_link" value="https://www.openstreetmap.org/' + element + '">';
      popup+='<p id="result"></p><div class="center"><input class="button short fill-darken3" type="submit" value="Submit" /></div></form></div>';
    } else {
      popup += 'Failed to request details from osm.org';
    }
    var pop = new mapboxgl.Popup()
    .setLngLat(lngLat)
    .setHTML(popup)
    .addTo(map)
    if(showTags.includes('winter_service:quality') && showTags.includes('winter_service')){
      document.querySelector("#winter_service").onchange = function (e) {
        document.querySelector("#plow_quality").disabled = (this.value != 'yes');
      }
      document.querySelector("#plow_quality").disabled = (this.value != 'yes');
    }
    $("#feedback").submit(function(event){

      var $form = $(this);
  		var $inputs = $form.find("input, select, button, textarea");
  		var serializedData = $form.serialize();
	    $inputs.prop("disabled", true);
  		$('#result').text('Sending ...');


      const tags = {};
      $('select').each(function(index) {
        tags[$(this)[0].name]=$(this)[0].value;
      });
      tags['fixme']=$('#fixme')[0].value;

      submitOsmChangeset(element, tags)
      .then(() => {
        $('#result').html('Your changes submitted!');
      })
      .catch(() => {
        $('#result').html('<font color="red">Failed to submit changes</font>');
      })
      event.preventDefault();

  	});
  }
  xhr.send()
}



function showMapillaryImage(lngLat) {
  const xhr = new XMLHttpRequest()
  xhr.open('GET','https://a.mapillary.com/v3/images/?radius=15&per_page=1&client_id=TG1sUUxGQlBiYWx2V05NM0pQNUVMQTo2NTU3NTBiNTk1NzM1Y2U2&closeto='+lngLat.lng+','+lngLat.lat)
  xhr.onload = function () {
    if (xhr.status === 200) {
      const result = JSON.parse(xhr.responseText)
      if(!result.features || result.features.length==0){
        return
      }
      document.getElementById('showMapillary').innerHTML = '<a href="https://www.mapillary.com/app/?focus=photo&pKey='+result.features[0].properties.key+'" target="_blank"><img class="enlarge-onhover" src="https://d1cuyjsrcm0gby.cloudfront.net/'+result.features[0].properties.key+'/thumb-640.jpg"></a>'
    }
  }
  xhr.send()
}


function nominatimGeocoder(query){

  const params = { format: "json", q: query, limit: 5, viewbox:'-76.36384,45.51697,-74.92326,45.03379', bounded: 1};
  const urlParams = new URLSearchParams(Object.entries(params));

  return fetch("//nominatim.openstreetmap.org/search?" + urlParams).then(function(response) {
    if(response.ok) {
      return response.json();
    } else {
      return [];
    }
  }).then(function(json) {
    return json.map(function(place) {
      return {
        center: [place.lon, place.lat],
        geometry: {
            type: "Point",
            coordinates: [place.lon, place.lat]
        },
        place_name: place.display_name,
        properties: {},
        type: 'Feature'
      };
    });
  });
};
