var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();

// The page runs on Live Server (port 5500), so the browser needs CORS to call the API on port 5000
builder.Services.AddCors(options =>
    options.AddDefaultPolicy(policy => policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();

app.UseCors();
app.MapControllers();

app.Run();
