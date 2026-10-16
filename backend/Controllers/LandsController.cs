using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc;

namespace OtagoApi.Controllers;

[ApiController]
[Route("api/lands")]
public class LandsController : ControllerBase
{
    // One lock for all requests, so two saves at the same time don't overwrite each other
    private static readonly object FileLock = new();

    // Indented, and characters like & and ā are written as they are, so the file is easy to read
    private static readonly JsonSerializerOptions FileOptions = new()
    {
        WriteIndented = true,
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    private readonly string _filePath;

    // Visual Studio runs the project from its folder, so this is backend/Data/lands.json
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
