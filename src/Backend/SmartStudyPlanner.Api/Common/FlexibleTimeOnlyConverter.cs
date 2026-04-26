using System.Text.Json;
using System.Text.Json.Serialization;

namespace SmartStudyPlanner.Api.Common;

public class FlexibleTimeOnlyConverter : JsonConverter<TimeOnly>
{
    private static readonly string[] Formats =
    {
        "HH:mm",
        "HH:mm:ss",
        "HH:mm:ss.f",
        "HH:mm:ss.ff",
        "HH:mm:ss.fff",
        "HH:mm:ss.fffffff"
    };

    public override TimeOnly Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var raw = reader.GetString();
        if (string.IsNullOrWhiteSpace(raw))
        {
            throw new JsonException("Time string is empty.");
        }
        return TimeOnly.ParseExact(raw, Formats, System.Globalization.CultureInfo.InvariantCulture);
    }

    public override void Write(Utf8JsonWriter writer, TimeOnly value, JsonSerializerOptions options)
    {
        writer.WriteStringValue(value.ToString("HH:mm:ss"));
    }
}

public class FlexibleNullableTimeOnlyConverter : JsonConverter<TimeOnly?>
{
    private static readonly FlexibleTimeOnlyConverter Inner = new();

    public override TimeOnly? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.Null) return null;
        return Inner.Read(ref reader, typeof(TimeOnly), options);
    }

    public override void Write(Utf8JsonWriter writer, TimeOnly? value, JsonSerializerOptions options)
    {
        if (value is null) writer.WriteNullValue();
        else Inner.Write(writer, value.Value, options);
    }
}
