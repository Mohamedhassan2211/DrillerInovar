using System.ComponentModel.DataAnnotations;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace OtagoApi.Controllers;

[ApiController]
[Route("api/map-image")]
public class MapImageController : ControllerBase
{
    private const string BasemapUrl = "https://basemaps.arcgis.com/arcgis/rest/services/World_Basemap_GCS_v2/VectorTileServer";

    private const string PrintUrl = "https://utility.arcgisonline.com/arcgis/rest/services/Utilities/PrintingTools/GPServer/Export%20Web%20Map%20Task/execute";

    private static readonly HttpClient Http = new();

    private static readonly object FileLock = new();

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    private readonly string _filePath;

    public MapImageController(IWebHostEnvironment env)
    {
        _filePath = Path.Combine(env.ContentRootPath, "Data", "images.json");
    }

    [HttpGet]
    public async Task<IActionResult> Get([BindRequired, Range(-180.0, 180.0)] double x, [BindRequired, Range(-90.0, 90.0)] double y)
    {
        var wgs84 = new { wkid = 4326 };
        var marker = new { type = "esriSMS", style = "esriSMSCircle", color = new[] { 255, 0, 0, 255 }, size = 14 };
        var pointLayer = new
        {
            layerDefinition = new { geometryType = "esriGeometryPoint" },
            featureSet = new
            {
                geometryType = "esriGeometryPoint",
                features = new[] { new { geometry = new { x, y, spatialReference = wgs84 }, symbol = marker } },
            },
        };

        var webMap = new
        {
            mapOptions = new { extent = new { xmin = x, ymin = y, xmax = x, ymax = y, spatialReference = wgs84 }, scale = 2000 },
            baseMap = new { baseMapLayers = new[] { new { type = "VectorTileLayer", styleUrl = $"{BasemapUrl}/resources/styles/root.json" } } },
            operationalLayers = new[] { new { featureCollection = new { layers = new[] { pointLayer } } } },
            exportOptions = new { outputSize = new[] { 1000, 700 } },
        };

        var response = await Http.PostAsync(PrintUrl, new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["Web_Map_as_JSON"] = JsonSerializer.Serialize(webMap),
            ["Format"] = "PNG32",
            ["Layout_Template"] = "MAP_ONLY",
            ["f"] = "json",
        }));

        var result = JsonNode.Parse(await response.Content.ReadAsStringAsync());
        var imageUrl = result?["results"]?[0]?["value"]?["url"]?.GetValue<string>();

        if (imageUrl is null)
            return StatusCode(StatusCodes.Status502BadGateway, result?["error"]);

        return File(await Http.GetByteArrayAsync(imageUrl), "image/png");
    }

    [HttpGet("info")]
    public IActionResult Info([BindRequired, Range(-180.0, 180.0)] double x, [BindRequired, Range(-90.0, 90.0)] double y)
    {
        var imageUrl = Url.ActionLink(nameof(Get), values: new { x, y });

        lock (FileLock)
        {
            var images = System.IO.File.Exists(_filePath)
                ? JsonNode.Parse(System.IO.File.ReadAllText(_filePath))!.AsArray()
                : new JsonArray();
            images.Add(new JsonObject
            {
                ["savedAt"] = DateTime.UtcNow,
                ["x"] = x,
                ["y"] = y,
                ["imageUrl"] = imageUrl,
                ["urlEsri"] = BasemapUrl,
            });
            System.IO.File.WriteAllText(_filePath, images.ToJsonString(JsonOptions));
        }

        var info = new JsonObject
        {
            ["status"] = true,
            ["errorCode"] = 0,
            ["error_Code"] = null,
            ["gis_code"] = "تم اخذ صوره",
            ["imageUrl"] = imageUrl,
            ["urlEsri"] = BasemapUrl,
        };

        return Content(info.ToJsonString(JsonOptions), "application/json; charset=utf-8");
    }
}
