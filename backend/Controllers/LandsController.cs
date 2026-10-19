using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc;

namespace OtagoApi.Controllers;

[ApiController]
[Route("api/lands")]
public class LandsController : ControllerBase
{
    private static readonly object FileLock = new();

    private static readonly JsonSerializerOptions FileOptions = new()
    {
        WriteIndented = true,
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    private readonly string _filePath;

    public LandsController(IWebHostEnvironment env)
    {
        _filePath = Path.Combine(env.ContentRootPath, "Data", "lands.json");
    }

    [HttpGet]
    public IActionResult GetAll()
    {
        lock (FileLock)
        {
            return Ok(ReadLands());
        }
    }

    [HttpPost]
    public IActionResult Save(JsonObject land)
    {
        lock (FileLock)
        {
            var lands = ReadLands();
            lands.Add(land);
            System.IO.File.WriteAllText(_filePath, lands.ToJsonString(FileOptions));
            return Created("api/lands", new { count = lands.Count });
        }
    }

    private JsonArray ReadLands() =>
        System.IO.File.Exists(_filePath)
            ? JsonNode.Parse(System.IO.File.ReadAllText(_filePath))!.AsArray()
            : new JsonArray();
}
