const apiKey = 'pk.eyJ1IjoiYWxmcmVkMjAxNiIsImEiOiJja2RoMHkyd2wwdnZjMnJ0MTJwbnVmeng5In0.E4QbAFjiWLY8k3AFhDtErA';

const mymap = L.map('map').setView([41.831392, -71.417804], 12.5);


// Constants
const date_obj = new Date();
date_obj.setHours(date_obj.getHours() - 2);

const currentYear = date_obj.getFullYear().toString();
const currentMonth = (date_obj.getMonth() + 1).toString().padStart(2, '0');
const currentDate = date_obj.getDate().toString().padStart(2, '0');
const currentHour = date_obj.getHours().toString().padStart(2, '0');




var date = currentYear + '-' + currentMonth + '-' + currentDate;
var time = currentHour + ':00:00';
time  = currentHour + ':00:00';
if (currentHour.length === 1) {
  currentHour = '0' + currentHour;
}



// //Variable later used for filtering
var CurrentDate = date + ' ' + time;


// Buttons 
var sidebar = document.getElementById('sidebar');
var closeButton = document.getElementById('close-button');
var MonitorName = document.getElementById("monitorName");
var MonitorTimeStart = document.getElementById("monitorTime");
var MonitorTimeEnd = document.getElementById("monitorTime2");
var pollValue = document.getElementById("pollValue");
var pollMarker = document.getElementById("pollMarker");
var pollName = document.getElementById("pollName");
var timelineSelect = document.getElementById('timeline-select');
var loader = document.getElementById('loader');
var noChart = document.getElementById('noChart');
var chart = document.getElementById('chart');
var NetworkName = document.getElementById('NetworkName');
var ChartTitle = document.getElementById("LevelTitle");
var centralLoader = document.getElementById('central-loader');


L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
    maxZoom: 18,
    id: 'mapbox/light-v10',
    tileSize: 512,
    zoomOffset: -1,
    accessToken: apiKey
}).addTo(mymap);


//// Non-Data Handling Helpers
function normalize(value, min, max) {
  return (value - min) / (max - min);
}

function roundToDecimal(number, decimalPlaces) {
  const factor = 10 ** decimalPlaces;
  return parseFloat((Math.round(number * factor) / factor).toFixed(decimalPlaces));
}

//change this to be a value and a type of pollutant
function getColor(value, pollutant) {


  // add an if statement that changes the color and scale values based on the color
  let color1, color2, percent;


  if(pollutant == 'co2') {
    color1 = [0, 31, 102];  // dark blue
    color2 = [229, 237, 255];  // light blue
    percent = 1 - (value - 350) / 200;

    
  } else if (pollutant == 'co') {
    color1 = [234, 255, 236];
    color2 =  [0,100,0];
    percent = normalize(value, 0, 0.4); 
  }
  


  if(value == -1) {
    return `#F5F5F5`};


  const color = [
    Math.round(color1[0] + (color2[0] - color1[0]) * percent),
    Math.round(color1[1] + (color2[1] - color1[1]) * percent),
    Math.round(color1[2] + (color2[2] - color1[2]) * percent)
  ];


  return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
}

// condenses the data by calculating the average
function processData(datetime, correctPollutant, chunkSize) {

  const dates = datetime.map(date => new Date(date));
  const data = dates.map((date, i) => ({ date, pollutant: correctPollutant[i] }));

  data.sort((a, b) => a.date - b.date);

  const chunkedData = _.chunk(data, chunkSize);
 

  const processedData = chunkedData.map(chunk => {
    const avgPollutant = _.meanBy(chunk, 'pollutant');
    const avgDate = chunk[Math.floor(chunk.length / 2)].date;
    const pcDate = avgDate.toISOString().slice(0, 19).replace('T', ' ');
    return { date: pcDate, pollutant: avgPollutant};
  });

  
  let processedDatetime = processedData.map(d => d.date);
  const processedPollutant = processedData.map(d => d.pollutant);

  return { processedDatetime, processedPollutant };
}


async function makeChart(data,timeRange,pollutant) {

  //variable for functions
  let filteredData, datetime, pollutant_corrected,roundPollutantBy;
  
  // variablesfor styling and chart
  let textTitle, textTitleMeasure, chartColor,adjustRange,measurement;


  // setting variables based on pollutant
  if (pollutant == 'co2') {
    filteredData = await data.filter(d => d.co2_corrected !== -1);
    datetime = await filteredData.map(d => d.datetime);
    pollutant_corrected = await filteredData.map(d => d.co2_corrected);
    measurement = ' (ppm) </p>';
    roundPollutantBy = 0;

    textTitle = 'CO<sub>2</sub>';
    textTitleMeasure = 'CO<sub>2</sub> (ppm)';
    chartColor = 'DarkBlue';
    adjustRange = 10;


  }else if (pollutant == 'co') {
    filteredData = await data.filter(d => d.co_corrected !== -1);
    datetime = await filteredData.map(d => d.datetime);
    pollutant_corrected = await filteredData.map(d => d.co_corrected);

    measurement = ' (ppm) </p>';
    roundPollutantBy = 3;
    textTitle = 'CO';
    textTitleMeasure = 'CO (ppm)';
    chartColor = 'DarkGreen';
    adjustRange = 0.01;
    

  }


  // Accounting for null data + styling
  if (pollutant_corrected.length === 0) {
    pollValue.innerHTML = '<p>Not Available</p>';
    let color = getColor(0,pollutant);
    pollMarker.innerHTML = "<span class='dot' style='background-color: " + color + ";'></span>";
    //make chart display nothing
    chart.style.display = 'none';
    noChart.innerHTML = '<p> No data available for this time period. </p>';
    return;
  } else{
    chart.style.display = 'block';
    noChart.innerHTML = '';
    let sum = pollutant_corrected.reduce((a, b) => a + b, 0);
    let avg = sum / pollutant_corrected.length;
    avg = (avg * 10) / 10;
    avg = avg.toFixed(roundPollutantBy);
    let stringAvg = avg.toString();
    pollValue.innerHTML = '<p>' + stringAvg + measurement;

    // generate color based the average for that node
    let color = getColor(avg,pollutant);

    pollMarker.innerHTML = "<span class='dot' style='background-color: " + color + ";'></span>";
  }

  let processedDatetime = datetime;
  let processedPollutant = pollutant_corrected;
  let xaxisTik = ''


  
  if (timeRange == 'day') {
    pollName.innerHTML = `<p>${textTitle} Daily</p>`;
  } else if (timeRange == 'week') {
    pollName.innerHTML = `<p>${textTitle} Weekly</p>`;
  } else if (timeRange == 'month') {
    pollName.innerHTML = `<p>${textTitle} Monthly</p>`;
  } else if (timeRange == 'all') {
    pollName.innerHTML = `<p>${textTitle} All</p>`;
  }


  //Styling the chart display
  if (timeRange == 'day') {
    xaxisTik = '%m/%d %H:%M';
  } else if (timeRange == 'week' || timeRange == 'month') { 
    xaxisTik = '%m-%d';
  } else if (timeRange == 'all') { 
    xaxisTik = '%Y-%m-%d';
  }

// condensing datapoints
if (pollutant_corrected.length > 120) {
      let chunkSize = 8;
      if (pollutant_corrected.length> 400){
        chunkSize = 40;
      }
      
      if (pollutant_corrected.length > 1000) {
        chunkSize = 200;
      }

      const { processedDatetime: pd, processedPollutant: pc } = processData(datetime,pollutant_corrected, chunkSize);
      processedDatetime = pd;
      processedPollutant = pc;
    
    }



  // Create a trace for the Pollutant values
  const pollutantTrace = {
    x: processedDatetime,
    y: processedPollutant,
    type: 'scatter',
    mode: 'lines+markers',
    name: textTitleMeasure,
    yaxis: 'y',
    line: {
      color: chartColor,
      width: 3
    },
    hoverinfo: 'none'
  };

  // creating bounds and ranges for the axis 
  yLowBound = Math.min(...processedPollutant) - adjustRange;
  yHighBound = Math.max(...processedPollutant) + adjustRange;


  // Define the layout with two y-axes
  var layout = {
    showlegend: false,
    yaxis: {
      range: [yLowBound, yHighBound],
      showline: true,
      zeroline: true,
      fixedrange: true,
      title: {
        text: textTitleMeasure,
        font: {
          size: 10},
      },
      tickfont:{
        size: 10,

      }
    },
    height: 350,
    xaxis: {
      showline: true,
      tickformat: xaxisTik,
      tickfont: {
        size: 9,      
      }
    },
    
    margin: {
      t: 5,
      l: 55, 
      r: 50, 
    },

  };

  // Combine the traces and layout and plot the chart
  const datas = [pollutantTrace];
  Plotly.newPlot('chart', datas, layout, {staticPlot: true});

}


//Defining the standard pollutant
let selectedPollutant = 'co2';


async function getTimeSeriesData(node, timeLine, pollutant) {
  try {
    const response = await axios.get('/timeseries', {
      params: {
        nodeId: node,
        date: timeLine,
        pollutant: pollutant
      }
    });

    return response.data;
  } catch (error) {
    console.error('Error fetching time series data:', error);
  }
}



async function updateMainData(pollutant) {
  const batch_num = 0;
  //maybe add a trigger for new data here
  const response = await axios.get('/main_data', {
    params: {
      pollutant_type: pollutant,
      batch_num: batch_num
    }
  });
  return response.data;

}

//new function for updating
async function getInitialData(pollutant,batch_num){
  const response = await axios.get('/initial_data', {
    params: {
      pollutant_type: pollutant,
      batch_num: batch_num
    }
  });
  return response.data;
}


// Global variables for pollutants
let co2Array = [];
let coArray = [];
let complimentaryPollutant = "";



async function updatePollutant(div) {
 
  //buttons
  const gradientDiv = div.querySelector('#gradient-div');
  const radioCO = div.querySelector('#co-option');
  const radioCO2 = div.querySelector('#co2-option');
  const maxValue = div.querySelector('#max-value');
  const minValue = div.querySelector('#min-value');
  const concentrationDef = div.querySelector('#concentration-tag');

  
  if (radioCO2.checked) {
    console.log('co2 checked');

    // changing the legend 
    gradientDiv.style.background = "linear-gradient(to bottom, rgb(0, 31, 102), rgb(39, 74, 146), rgb(77, 117, 190), rgb(115, 160, 234), rgb(153, 187, 244), rgb(191, 213, 253), rgb(214, 226, 255), rgb(229, 237, 255))";
    maxValue.innerHTML = '600 ppm';
    minValue.innerHTML = '350 ppm';
    selectedPollutant = 'co2';

    //changing the chart
    closeButton.style.backgroundImage = "url('./icons/cross_png_clean.png')";
    NetworkName.style.backgroundImage = "url('./icons/breathe_icon.png')";
    ChartTitle.innerHTML =  "Average CO<sub>2</sub> Levels";
    loader.style.borderTop = '8px solid darkblue';
    concentrationDef.innerHTML = '<b> Concentration (ppm):<b>';

    makeMap(co2Array, selectedPollutant);
    

  } else if (radioCO.checked) {
    console.log('co checked');

    //if the array is empty, than make display the loading thing in green and wait until the execution is finished to load
    if(coArray.length === 0){
      centralLoader.style.display = 'block';
      centralLoader.style.borderTop = '8px solid darkgreen';

      console.log("Function activated");

      const fetchArrayBatchOne = await getInitialData("co", 1);
      const fetchArrayBatchTwo = await getInitialData("co", 2);
      const fetchArrayBatchThree = await getInitialData("co", 3);

      console.log("This is the resulting coArray",coArray);
      coArray = [...fetchArrayBatchOne,...fetchArrayBatchTwo,...fetchArrayBatchThree];

      // request the data ?
    }

    //changing the legend 
    gradientDiv.style.background = "linear-gradient(to bottom,rgb(0,100,0), rgb(116, 150, 113), rgb(143, 188, 139), rgb(209, 242, 206), rgb(236, 252, 235))";
    maxValue.innerHTML = '0.4 ppm';
    minValue.innerHTML = '0.0 ppm';
    selectedPollutant = 'co';

   //changing the chart
   closeButton.style.backgroundImage = "url('./icons/cross_green_clean.png')";  
   NetworkName.style.backgroundImage = "url('./icons/breathe_icon_green.png')";
   ChartTitle.innerHTML =  "Average CO Levels";
   loader.style.borderTop = '8px solid darkgreen';
   concentrationDef.innerHTML = '<b> Concentration (ppm):<b>';

   makeMap(coArray, selectedPollutant);

  }
  console.log("Updates requested for: ", selectedPollutant);
}



class LegendControl extends L.Control {
  // Define the onAdd method
  onAdd() {
      const div = L.DomUtil.create('div', 'legend');
      div.style.backgroundColor = "white";
      div.style.padding = "6px";
      div.style.borderRadius = "6px";
      div.style.width = "141.28px";
      div.style.height = "317.29px";
      div.style.position = "absolute";
      div.style.right = "610px";
      div.style.top = "450px";
      div.style.fontSize = "14px";
      div.innerHTML =  `
      <div>
        <b>Legend</b>
        <br>
        Date: ${date}
        <br>
        Time: ${time}
        <br>
        <b>Pollutants:</b>
        <ul style="list-style: none; margin: 0; padding: 0"">
          <li>
            <input type="radio" id="co-option" name="selector" onchange="updatePollutant(this.parentElement.parentElement.parentElement)">
            <label for="f-option">CO</label>
          </li>
          <li>
            <input type="radio" id="co2-option" name="selector" checked="checked" onchange="updatePollutant(this.parentElement.parentElement.parentElement)">
            <label for="s-option">CO<sub>2</sub></label>
          </li>
        </ul>
          <div id="concentration-tag"><b>Concentration (ppm):</b> </div>
          <br>
          <div style="display: inline-block; vertical-align: top; margin-top: -20px;">
          <div id="max-value" style="height: 20px;">600 ppm </div>
          <div id="gradient-div" style="display:inline-block; width: 20px; height: 120px; background: linear-gradient(to bottom, rgb(0, 31, 102), rgb(39, 74, 146), rgb(77, 117, 190), rgb(115, 160, 234), rgb(153, 187, 244), rgb(191, 213, 253), rgb(214, 226, 255), rgb(229, 237, 255));;"></div>
          <br>
          <div id="min-value" style="height: 20px;">350 ppm </div>
          </div>
          </div>
      </div>`;

    


      return div;
  }
}

const legendControl = new LegendControl();

// Add the custom control to the map
mymap.addControl(legendControl);




// Fetching the general data info
async function getInfoHelper(){
  const response = await fetch('sensors_with_nodes.json');
  const data = await response.json();
  return data;

}

function organizeDataByNodeId(jsonData) {
  var dataByNodeId = {};

  // Iterate through the original JSON data and organize it by Node ID
  jsonData.forEach(function(sensor) {
    var nodeId = sensor["Node ID"];
    dataByNodeId[nodeId] = sensor;
  });

  return dataByNodeId;
}

//GLOBAL VARIABLES
var markerArray = [];


//plot markers helper
function plotMarkers(coordinates, pollutant) {

  console.log(coordinates);


  // marker array not empty then loop throuh and remove all of the markers
  if (markerArray.length > 0) {
    for (let i = 0; i < markerArray.length; i++) {
      mymap.removeLayer(markerArray[i].marker);
    }
  }

  //setting names
  let pollutantName, measurement,measurementName,roundPollutantBy;

  if (pollutant == "co2") {
    pollutantName = "co2_corrected";
    measurement = " (ppm)";
    measurementName = "CO<sub>2</sub>";
    roundPollutantBy = 0;

  } else if (pollutant == "co") {
    pollutantName = "co_corrected";
    measurement = " (ppm)";
    measurementName = "CO";
    roundPollutantBy = 3;
  }

  for (let i = 0; i < coordinates.length; i++) {
    console.log("This is the current Node ID", coordinates[i]["Node ID"])
    const lat = coordinates[i]["Latitude"];
    const lon = coordinates[i]["Longitude"];
    let color = getColor(coordinates[i][pollutantName], pollutant);


  let circleMarker = L.circleMarker([lat, lon], {
    radius: 8,
    color: 'black',
    weight: 1,
    fillColor: color,
    fillOpacity: 0.8
    });

  

  // if the marker is not  already in the array, add it
  if (!markerArray.includes(circleMarker)){
    markerArray.push({ marker: circleMarker, nodeId: coordinates[i]["Node ID"] });
  }

  
  let roundedPollutant = coordinates[i][pollutantName].toFixed(roundPollutantBy);


  // TODO: Revise this part
  if(coordinates[i][pollutantName] == -1) {
    //TODO: Change this include other things about the pollutant
    circleMarker.bindPopup("Location: " + coordinates[i]["Location"] + "<br>" + measurementName + " Level: Not Available");
  }else{
    circleMarker.bindPopup("Location: " + coordinates[i]["Location"] + "<br>" + measurementName + " Level: " + roundedPollutant + measurement);
  }
  circleMarker.addTo(mymap);

}

centralLoader.style.display = 'none';

console.log("this is the amoutn of ploted markers", markerArray.length)

return markerArray;


}

async function DisplayTimeseries(event, nodeId,coordinates, pollutant) {

  console.log(event);
    timeLine = timelineSelect.value;
    if (timeLine == "day") {
      makeChart(coordinates.filter(dataPoint => dataPoint["Node ID"] == nodeId), "day", pollutant);
    } else if (timeLine == "week") {

      //activate loading
      loader.style.display = 'block';
      chart.style.display = 'none';

      //TODO: Rething this part
      if (nodeId == -1) {
        noChart.innerHTML = ''
      }

      getTimeSeriesData(nodeId, "week",pollutant).then(function(weekData) {
        makeChart(weekData, "week", pollutant);
        loader.style.display = 'none';
      });

    } else if (timeLine == "month") {

      // // activate loading
      loader.style.display = 'block';
      chart.style.display = 'none';

      getTimeSeriesData(nodeId, "month",pollutant).then(function(monthData) {
        makeChart(monthData, "month", pollutant);
        loader.style.display = 'none';
      });

    } else if (timeLine == "all") {

      // activate loading
      loader.style.display = 'block';
      chart.style.display = 'none';

      getTimeSeriesData(nodeId, "all",pollutant).then(function(allData) {
        makeChart(allData, "all", pollutant);
        loader.style.display = 'none';
      });

    }

  }



async function DisplaySidebar(event, nodeId,coordinates, pollutant) {


  // extracting general information about the node
  const generalNodeInfo = await getInfoHelper();
  const generalByNodeId = organizeDataByNodeId(generalNodeInfo);


  // getting information for a specific pollutant
  let pollutantNameHTML, pollutantNameJSON;
  if (pollutant == 'co2') {
    pollutantNameHTML = '<p>CO<sub>2</sub> Daily</p>';
    pollutantNameJSON = 'co2_corrected';
  } else if (pollutant == 'co') {
    pollutantNameHTML = '<p>CO Daily</p>';
    pollutantNameJSON = 'co_corrected';
  }

  // event listener reference
  const timelineSelectHandler = (event) => DisplayTimeseries(event, nodeId, coordinates, pollutant);

    if (sidebar) {
      // make it visable 
      sidebar.style.display = 'block';

      // add the names
      MonitorName.innerHTML = '<p>' + generalByNodeId[nodeId]["Location"] + '</p>';

      const installationDate = generalByNodeId[nodeId]["Installation Date"]; 
      const startDate = new Date(installationDate);
      const endDate = new Date();

      const options = { year: 'numeric', month: 'long', day: 'numeric' };

      MonitorTimeStart.innerHTML = `<p>Installed from: ${startDate.toLocaleDateString('en-US', options)}</p>`;
      MonitorTimeEnd.innerHTML = `<p>To: ${endDate.toLocaleDateString('en-US', options)}</p>`;

      pollName.innerHTML = pollutantNameHTML;

      //make Timeselect default to day 
      timelineSelect.value = "day";

      loader.style.display = 'none';


      // display this since day is the default
      makeChart(coordinates.filter(dataPoint => dataPoint["Node ID"] == generalByNodeId[nodeId]["Node ID"]), "day", selectedPollutant);
    

      // add the event listener for the timeseries
      timelineSelect.addEventListener('change',timelineSelectHandler);

    }
  
    closeButton.addEventListener('click', function(event) {
      // Hide the sidebar
      sidebar.style.display = 'none';
      // remove the event listener
      timelineSelect.removeEventListener('change', timelineSelectHandler);
    });
    
    

}

//make the pollutant be passed in 
async function makeMap(coordinates,pollutant) { 

  var markerArray = plotMarkers(coordinates, pollutant);

 
  // get last date that was emitted
  const filteredCoordinates = coordinates.filter(obj => obj.datetime !== -1);
  maxDatetime = filteredCoordinates.reduce((max, obj) => obj.datetime > max ? obj.datetime : max, "");


  for (const item of markerArray) {
    const circleMarker = item.marker;
    const nodeId = item.nodeId;
    circleMarker.on('click', (event) => DisplaySidebar(event, nodeId, coordinates, pollutant));
  }
}

console.log("Pollutant:", selectedPollutant);



//make a function that deals with initializing the map 
async function initMap(){

  centralLoader.style.display = 'block';


  // ask for the pollutant data and make co2 the default
  const fetchArrayBatchOne = await getInitialData(selectedPollutant, 1);
  const fetchArrayBatchTwo = await getInitialData(selectedPollutant, 2);
  const fetchArrayBatchThree = await getInitialData(selectedPollutant, 3);

  console.log("Batch One", fetchArrayBatchOne);
  console.log("Batch Two", fetchArrayBatchTwo);
  console.log("Batch Three", fetchArrayBatchThree);

  co2Array = [...fetchArrayBatchOne,...fetchArrayBatchTwo,...fetchArrayBatchThree];
  makeMap(co2Array,selectedPollutant);

  if (selectedPollutant == 'co2') {
    complimentaryPollutant = 'co';
  } else if (selectedPollutant == 'co') {
    complimentaryPollutant = 'co2';
  }

}




initMap().then( async function() {
  console.log("Processing fetch of data for CO  ...");
  const fetchArrayBatchOne = await getInitialData(complimentaryPollutant, 1);
  const fetchArrayBatchTwo = await getInitialData(complimentaryPollutant, 2);
  const fetchArrayBatchThree = await getInitialData(complimentaryPollutant, 3);
  coArray = [...fetchArrayBatchOne,...fetchArrayBatchTwo,...fetchArrayBatchThree];
  console.log(coArray);
  console.log("Data fetch complete!");
});

// asynchronous fetching for after call 
async function updateMap(pollutant) {
  if (pollutant == "co") {
    coArray = await updateMainData("co");
    makeMap(coArray, pollutant).then(function() {
      co2Array = updateMainData("co2");
    });
  } else if (pollutant == "co2"){
    co2Array = await updateMainData("co2");
    makeMap(co2Array, pollutant).then(function() {
      coArray = updateMainData("co");
    });
  }

}



// Function to calculate the time until the next straight hour
function timeUntilNextHour() {
  const now = new Date();
  const nextHour = new Date(now);
  nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0); 
  const nextTime = nextHour.getTime() - now.getTime()
  console.log("Time until the next hour:", nextTime, "milliseconds");
  return nextTime;
}


function scheduleDataUpdate() {
  const delay = 10000; 
  const timeUntilNext = timeUntilNextHour();
  
  console.log("Scheduling update in", timeUntilNext + delay, "milliseconds");
  

  //TODO come back to this
  setTimeout(() => {
    updateMap(selectedPollutant);
    setInterval(processData, 3600000); // Schedule subsequent updates every hour
    console.log("Update successful!");
  }, timeUntilNext + delay);
}


// Call the initial scheduling function
scheduleDataUpdate();
