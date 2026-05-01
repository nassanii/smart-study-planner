using System.Text.Json;
using System.Text.Json.Serialization;

namespace SmartStudyPlanner.Api.Common;

public class FlexibleDateOnlyConverter : JsonConverter<DateOnly>
{
    private static readonly string[] Formats =
    {
        "yyyy-MM-dd",
        "yyyy/MM/dd",
        "dd-MM-yyyy",
        "dd/MM/yyyy"
    };

    public override DateOnly Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var raw = reader.GetString();
        if (string.IsNullOrWhiteSpace(raw))
        {
            return default;
        }

        if (DateOnly.TryParseExact(raw, Formats, System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.None, out var date))
        {
            return date;
        }

        // Fallback to standard parsing if custom formats fail
        return DateOnly.Parse(raw);
    }

    public override void Write(Utf8JsonWriter writer, DateOnly value, JsonSerializerOptions options)
    {
        writer.WriteStringValue(value.ToString("yyyy-MM-dd"));
    }
}

public class FlexibleNullableDateOnlyConverter : JsonConverter<DateOnly?>
{
    private static readonly FlexibleDateOnlyConverter Inner = new();

    public override DateOnly? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.Null) return null;
        var raw = reader.GetString();
        if (string.IsNullOrWhiteSpace(raw)) return null;
        
        try 
        {
            return Inner.Read(ref reader, typeof(DateOnly), options);
        }
        catch 
        {
            return null;
        }
    }

    public override void Write(Utf8JsonWriter writer, DateOnly? value, JsonSerializerOptions options)
    {
        if (value is null) writer.WriteNullValue();
        else Inner.Write(writer, value.Value, options);
    }
}
